/**
 * Teste manual da agenda (Parte 5), contra o banco configurado no .env.
 *
 *   npx ts-node scripts/testAgenda.ts            executa e, no fim, remove (exclusão lógica) o que criou
 *   npx ts-node scripts/testAgenda.ts --manter   mantém os agendamentos criados
 *
 * Demonstra: criação, conflito de horário, horário de funcionamento, profissional
 * não habilitado, feriado nacional (aviso + confirmação), máquina de estados,
 * conclusão com valor cobrado, histórico e estatísticas.
 * O relógio do service é injetado para simular "depois do atendimento".
 */
import { Database } from '../src/main/core/database/Database';
import { DomainError } from '../src/main/core/entities';
import { DataHora } from '../src/main/core/entities/Agendamento';
import {
  AgendamentoRepository,
  ClienteRepository,
  ProfissionalRepository,
  ServicoRepository,
} from '../src/main/core/repositories';
import { AgendamentoService, DadosAgendamento, EstatisticasService, HistoricoService } from '../src/main/core/services';
import { FeriadosClient } from '../src/main/integrations/FeriadosClient';

// Dados do seed: Diego Lima (tatuador, id 3) faz "Retoque de tatuagem" (id 3, 60 min);
// "Limpeza de pele profunda" (id 4) é de estética; Bruno Carvalho (cliente 2) é maior de idade.
const PROFISSIONAL = 3;
const SERVICO = 3;
const SERVICO_ESTETICA = 4;
const CLIENTE = 2;

class TesteAgenda {
  private falhas = 0;
  private agora = new Date();
  private readonly criados: number[] = [];
  private readonly db = Database.getInstance();
  private readonly repo = new AgendamentoRepository(this.db);
  private readonly feriados = new FeriadosClient();
  private readonly agenda = new AgendamentoService(
    this.repo,
    new ClienteRepository(this.db),
    new ProfissionalRepository(this.db),
    new ServicoRepository(this.db),
    this.feriados,
    this.db,
    undefined,
    () => this.agora,
  );
  private readonly historico = new HistoricoService(this.repo, new ClienteRepository(this.db));
  private readonly estatisticas = new EstatisticasService(this.db);

  constructor(private readonly manter: boolean) {}

  public async executar(): Promise<boolean> {
    try {
      await this.cenarios();
    } finally {
      await this.limpar();
    }
    console.log(this.falhas === 0 ? '\n✔ Todos os testes da agenda passaram.' : `\n✖ ${this.falhas} teste(s) falharam.`);
    return this.falhas === 0;
  }

  private async cenarios(): Promise<void> {
    // 1. Criação num horário livre (dia útil, sem feriado, 14:00)
    const inicio = await this.horarioLivre();
    const salvo = await this.agenda.criar(this.dados(inicio));
    const a = salvo.agendamento;
    if (!a) throw new Error('Agendamento não foi criado.');
    this.criados.push(a.id);
    this.check(a.status === 'AGENDADO', `Criado #${a.id}: ${a.servicoNome} com ${a.profissionalNome}, ${a.inicio} → ${a.fim} (fim pela duração do serviço)`);

    // 2. Conflito de horário (mesmo profissional, 30 min depois)
    await this.erro('Conflito de horário', 'ConflictError', () =>
      this.agenda.criar(this.dados(DataHora.somarMinutos(inicio, 30))),
    );
    // Encostado (começa exatamente quando o outro termina) não é conflito
    const encostado = await this.agenda.criar(this.dados(DataHora.somarMinutos(inicio, 60)));
    if (encostado.agendamento) this.criados.push(encostado.agendamento.id);
    this.check(encostado.agendamento !== null, 'Horário encostado (fim de um = início do outro) é permitido');

    // 3. Regras de horário e de cadastro
    const noite = new Date(inicio); noite.setHours(19, 30);
    await this.erro('Fora do horário de funcionamento (19:30 + 60 min)', 'ValidationError', () => this.agenda.criar(this.dados(noite)));
    const domingo = new Date(inicio); domingo.setDate(domingo.getDate() + ((7 - domingo.getDay()) % 7 || 7));
    await this.erro('Domingo', 'ValidationError', () => this.agenda.criar(this.dados(domingo)));
    await this.erro('Data no passado', 'ValidationError', () => this.agenda.criar(this.dados(new Date(2020, 0, 6, 10, 0))));
    await this.erro('Profissional não habilitado para o serviço', 'ConflictError', () =>
      this.agenda.criar({ ...this.dados(inicio), servicoId: SERVICO_ESTETICA }),
    );

    // 4. Feriado nacional: aviso, depois confirmação
    const feriado = await this.proximoFeriadoUtil();
    if (feriado) {
      const semFlag = await this.agenda.criar(this.dados(feriado.data));
      this.check(semFlag.requerConfirmacao && semFlag.agendamento === null, `Feriado sem confirmação → não salva: "${semFlag.avisos[0]}"`);
      const comFlag = await this.agenda.criar({ ...this.dados(feriado.data), confirmarFeriado: true });
      if (comFlag.agendamento) this.criados.push(comFlag.agendamento.id);
      this.check(comFlag.agendamento !== null, `Feriado confirmado → salvo com aviso: "${comFlag.avisos[0]}"`);
    } else {
      this.check(false, 'Não foi possível obter feriados da BrasilAPI (sem internet?)');
    }

    // 5. Máquina de estados e conclusão
    await this.erro('Concluir sem confirmar (AGENDADO → CONCLUIDO)', 'ConflictError', () => this.agenda.concluir(a.id, 150), 'Transição inválida');
    const confirmado = await this.agenda.confirmar(a.id);
    this.check(confirmado.status === 'CONFIRMADO', 'AGENDADO → CONFIRMADO');
    await this.erro('Concluir antes do horário', 'ConflictError', () => this.agenda.concluir(a.id, 150), 'ainda não começou');

    this.agora = DataHora.somarMinutos(inicio, 70); // simula "depois do atendimento"
    const concluido = await this.agenda.concluir(a.id, 135.5, 'Retoque sem intercorrências.');
    this.check(concluido.status === 'CONCLUIDO' && concluido.valorCobrado === 135.5, `CONFIRMADO → CONCLUIDO com valor cobrado R$ ${concluido.valorCobrado?.toFixed(2)}`);
    await this.erro('Cancelar atendimento concluído', 'ConflictError', () => this.agenda.cancelar(a.id));
    await this.erro('Excluir atendimento concluído (é histórico)', 'ConflictError', () => this.agenda.excluir(a.id));

    // 6. Histórico e estatísticas
    const hist = await this.historico.porCliente(CLIENTE, { limit: 5 });
    this.check(hist.items.some((h) => h.agendamentoId === a.id), `Histórico do cliente: ${hist.total} atendimento(s), total R$ ${hist.valorTotal.toFixed(2)}`);
    const dia = DataHora.formatarData(inicio);
    const est = await this.estatisticas.resumo({ dataInicio: dia, dataFim: dia });
    this.check(est.atendimentosConcluidos >= 1 && est.faturamento >= 135.5, `Estatísticas do dia ${dia}: ${est.atendimentosConcluidos} concluído(s), R$ ${est.faturamento.toFixed(2)}`);

    // 7. Cancelar e excluir (lógico) o agendamento encostado
    if (encostado.agendamento) {
      const cancelado = await this.agenda.cancelar(encostado.agendamento.id, 'Teste de cancelamento');
      this.check(cancelado.status === 'CANCELADO', 'AGENDADO → CANCELADO (motivo registrado nas observações)');
      await this.agenda.excluir(encostado.agendamento.id);
      const lista = await this.agenda.listar({ profissionalId: PROFISSIONAL, de: new Date(inicio.toDateString()), ate: DataHora.somarMinutos(inicio, 24 * 60) });
      this.check(!lista.items.some((x) => x.id === encostado.agendamento?.id), 'Excluído some da agenda (exclusão lógica)');
    }
  }

  private dados(inicio: Date): DadosAgendamento {
    return { clienteId: CLIENTE, profissionalId: PROFISSIONAL, servicoId: SERVICO, inicio, observacoes: 'Criado por scripts/testAgenda.ts', confirmarFeriado: false };
  }

  /** Próximo dia útil (seg–sáb, sem feriado) entre 20 e 200 dias à frente com 14:00–16:00 livre. */
  private async horarioLivre(): Promise<Date> {
    for (let tentativa = 0; tentativa < 200; tentativa++) {
      const d = new Date();
      d.setDate(d.getDate() + 20 + Math.floor(Math.random() * 180));
      d.setHours(14, 0, 0, 0);
      if (d.getDay() === 0 || (await this.feriados.ehFeriado(d))) continue;
      if (!(await this.repo.existeConflito(PROFISSIONAL, d, DataHora.somarMinutos(d, 120)))) return d;
    }
    throw new Error('Nenhum horário livre encontrado.');
  }

  /** Próximo feriado nacional futuro que caia de segunda a sábado (11:00 livre). */
  private async proximoFeriadoUtil(): Promise<{ data: Date; nome: string } | null> {
    const hoje = new Date();
    for (const ano of [hoje.getFullYear(), hoje.getFullYear() + 1]) {
      const lista = await this.feriados.feriadosDoAno(ano);
      if (!lista) return null;
      for (const [iso, nome] of [...lista.entries()].sort()) {
        const d = DataHora.parse(`${iso}T11:00`);
        if (d && d > hoje && d.getDay() !== 0 && !(await this.repo.existeConflito(PROFISSIONAL, d, DataHora.somarMinutos(d, 60)))) {
          return { data: d, nome };
        }
      }
    }
    return null;
  }

  private async limpar(): Promise<void> {
    if (this.manter) {
      console.log(`ℹ --manter: agendamentos ${this.criados.join(', ')} mantidos.`);
      return;
    }
    for (const id of this.criados) {
      // Limpeza do teste direto no repository (o service não deixa excluir concluídos, de propósito).
      await this.repo.softDelete(id);
    }
    console.log(`ℹ Limpeza: agendamentos de teste ${this.criados.join(', ')} marcados como inativos.`);
  }

  private check(condicao: boolean, descricao: string): void {
    console.log(`${condicao ? '✔' : '✖'} ${descricao}`);
    if (!condicao) this.falhas++;
  }

  private async erro(descricao: string, tipo: string, acao: () => Promise<unknown>, trechoMensagem?: string): Promise<void> {
    try {
      const r = await acao();
      const id = (r as { agendamento?: { id: number } | null })?.agendamento?.id;
      if (id) this.criados.push(id);
      this.check(false, `${descricao}: deveria ter sido bloqueado`);
    } catch (error) {
      const ok = error instanceof DomainError && error.name === tipo &&
        (!trechoMensagem || error.message.includes(trechoMensagem));
      this.check(ok, `${descricao} bloqueado (${(error as Error).name}): "${(error as Error).message}"`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const ok = await new TesteAgenda(process.argv.includes('--manter')).executar();
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error('✖ Erro inesperado:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await Database.getInstance().close();
  }
}

void main();
