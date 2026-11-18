/**
 * Teste manual dos lembretes (Parte 6), em MODO SIMULAÇÃO (nenhum e-mail sai do computador).
 *
 *   npx ts-node scripts/testLembretes.ts            executa e, no fim, inativa o que criou
 *   npx ts-node scripts/testLembretes.ts --manter   mantém os registros criados
 *
 * Cria agendamentos para amanhã e dispara o processamento. Demonstra: envio simulado
 * com dica de clima, cliente sem e-mail (ignorado com motivo), falha com até 3
 * tentativas, ausência de duplicidade e reenvio manual.
 * Obs.: o processamento é global — outros agendamentos de amanhã ainda sem lembrete
 * (ex.: do seed) também recebem lembrete simulado.
 */
import { Database } from '../src/main/core/database/Database';
import { DataHora } from '../src/main/core/entities/Agendamento';
import { Cliente } from '../src/main/core/entities/Cliente';
import { AgendamentoRepository, ClienteRepository } from '../src/main/core/repositories';
import { LembreteRepository } from '../src/main/core/repositories/LembreteRepository';
import {
  EnviadorEmail,
  LembreteService,
  MensagemLembrete,
  NotificacaoEmailService,
  ResultadoEnvio,
} from '../src/main/core/services';
import { ClimaClient } from '../src/main/integrations/ClimaClient';

// Seed: Camila Rocha (esteticista, id 4) faz "Design de sobrancelha" (id 6, 45 min);
// Ana Beatriz Martins (cliente 1) tem e-mail.
const PROFISSIONAL = 4;
const SERVICO = 6;
const CLIENTE_COM_EMAIL = 1;

/** Simula um servidor SMTP fora do ar. */
class EnviadorQueFalha implements EnviadorEmail {
  public readonly modoSimulacao = false;
  public async enviar(): Promise<ResultadoEnvio> {
    throw new Error('Falha no envio SMTP (ECONNREFUSED).');
  }
}

class TesteLembretes {
  private falhas = 0;
  private readonly db = Database.getInstance();
  private readonly agendamentos = new AgendamentoRepository(this.db);
  private readonly clientes = new ClienteRepository(this.db);
  private readonly repo = new LembreteRepository(this.db);
  private readonly clima = new ClimaClient();
  private readonly logs: string[] = [];
  private readonly simulacao = new NotificacaoEmailService(null, (m) => this.logs.push(m));
  private readonly service = new LembreteService(this.repo, this.simulacao, this.clima);
  private readonly criados = { agendamentos: [] as number[], clientes: [] as number[] };

  constructor(private readonly manter: boolean) {}

  public async executar(): Promise<boolean> {
    try {
      await this.cenarios();
    } finally {
      await this.limpar();
    }
    console.log(this.falhas === 0 ? '\n✔ Todos os testes de lembretes passaram.' : `\n✖ ${this.falhas} teste(s) falharam.`);
    return this.falhas === 0;
  }

  private async cenarios(): Promise<void> {
    this.check(this.simulacao.modoSimulacao, 'NotificacaoEmailService em modo simulação (SMTP não configurado)');

    // Agendamentos de amanhã: um com e-mail, um de cliente sem e-mail, um que vai falhar
    const comEmail = await this.agendarAmanha(CLIENTE_COM_EMAIL);
    const semEmailCliente = await this.clienteSemEmail();
    const semEmail = await this.agendarAmanha(semEmailCliente);
    console.log(`ℹ Agendamentos de teste para amanhã: #${comEmail} (com e-mail), #${semEmail} (cliente sem e-mail)`);

    // 1. Processamento em simulação
    const r1 = await this.service.processarLembretesDoDiaSeguinte();
    const d1 = (id: number) => r1.detalhes.find((d) => d.agendamentoId === id);
    console.log(`ℹ Processamento: ${r1.verificados} verificado(s), ${r1.simulados} simulado(s), ${r1.ignorados} ignorado(s), ${r1.falhas} falha(s)`);
    this.check(d1(comEmail)?.resultado === 'ENVIADO_SIMULADO', `Lembrete do #${comEmail} enviado em simulação`);
    this.check(d1(semEmail)?.resultado === 'IGNORADO', `Cliente sem e-mail ignorado: "${d1(semEmail)?.motivo}"`);
    const l1 = await this.repo.findByAgendamento(comEmail);
    this.check(l1?.status === 'ENVIADO' && l1.simulado && l1.enviadoEm !== null, `Registrado no banco: status ${l1?.status}, simulado, enviado em ${l1?.enviadoEm ? DataHora.formatar(l1.enviadoEm) : '-'}`);
    this.check(this.logs.some((m) => m.includes('a***@')), `Log sem e-mail completo: ${this.logs.find((m) => m.includes('a***@'))}`);

    // 2. Sem duplicidade: nova execução não reenvia
    const r2 = await this.service.processarLembretesDoDiaSeguinte();
    this.check(!r2.detalhes.some((d) => d.agendamentoId === comEmail || d.agendamentoId === semEmail), 'Segunda execução não reenvia nem duplica lembretes');

    // 3. Falha com retentativas (SMTP fora do ar)
    const vaiFalhar = await this.agendarAmanha(CLIENTE_COM_EMAIL);
    const servicoQueFalha = new LembreteService(this.repo, new EnviadorQueFalha(), this.clima);
    for (let i = 1; i <= 4; i++) {
      const r = await servicoQueFalha.processarLembretesDoDiaSeguinte();
      const d = r.detalhes.find((x) => x.agendamentoId === vaiFalhar);
      const l = await this.repo.findByAgendamento(vaiFalhar);
      if (i <= 3) this.check(d?.resultado === 'FALHA' && l?.tentativas === i, `Execução ${i}: FALHA registrada (tentativas = ${l?.tentativas}) — "${d?.motivo}"`);
      else this.check(d === undefined, 'Execução 4: tentativas esgotadas, lembrete não é mais tentado');
    }

    // 4. Reenvio manual (recepção) com SMTP "de volta" (simulação)
    const lFalha = await this.repo.findByAgendamento(vaiFalhar);
    const reenvio = await this.service.reenviar(lFalha?.id as number);
    this.check(reenvio.resultado === 'ENVIADO_SIMULADO', 'Reenvio manual zera tentativas e envia');

    // 5. Mensagem gerada (com dica de clima de amanhã)
    const dados = await this.repo.agendamentoParaLembrete(comEmail);
    const previsao = await this.clima.previsao(dados?.inicio as Date);
    const msg = MensagemLembrete.montar({
      clienteNome: dados?.clienteNome ?? '', inicio: dados?.inicio as Date, fim: dados?.fim as Date,
      profissionalNome: dados?.profissionalNome ?? '', servicoNome: dados?.servicoNome ?? '',
      servicoCategoria: dados?.servicoCategoria ?? 'ESTETICA', studioNome: 'Ink & Glow Studio',
      studioEndereco: 'Rua Exemplo, 123 - Centro', previsao,
    });
    this.check(msg.html.includes('Como se preparar') && msg.assunto.startsWith('Lembrete:'), `Assunto: "${msg.assunto}"`);
    console.log(`ℹ Previsão usada: ${previsao ? JSON.stringify(previsao) : 'indisponível (lembrete sai sem dica de clima)'}`);
    console.log('--- texto do e-mail ---\n' + msg.texto + '\n-----------------------');

    // 6. Listagem
    const lista = await this.service.listar({ agendamentoId: comEmail });
    this.check(lista.total === 1 && lista.items[0].simulado, 'Listagem mostra o lembrete com flag "simulado"');
  }

  /** Cria um agendamento CONFIRMADO para amanhã num horário livre (direto no repository, só para o teste). */
  private async agendarAmanha(clienteId: number): Promise<number> {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    for (let minutos = 9 * 60; minutos <= 18 * 60; minutos += 45) {
      const inicio = new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate(), 0, minutos);
      const fim = DataHora.somarMinutos(inicio, 45);
      if (await this.agendamentos.existeConflito(PROFISSIONAL, inicio, fim)) continue;
      const a = await this.agendamentos.create({
        clienteId, profissionalId: PROFISSIONAL, servicoId: SERVICO, inicio, fim,
        status: 'CONFIRMADO', valorCobrado: null, observacoes: 'Criado por scripts/testLembretes.ts',
      });
      this.criados.agendamentos.push(a.id as number);
      return a.id as number;
    }
    throw new Error('Sem horário livre amanhã para o teste.');
  }

  private async clienteSemEmail(): Promise<number> {
    const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    for (const t of [9, 10]) {
      const r = (n.slice(0, t).reduce((acc, d, i) => acc + d * (t + 1 - i), 0) * 10) % 11;
      n.push(r === 10 ? 0 : r);
    }
    const c = await this.clientes.create(
      Cliente.criar({ nome: 'Cliente Sem Email Teste', cpf: n.join(''), dataNascimento: '1990-01-01' }).toProps(),
    );
    this.criados.clientes.push(c.id as number);
    return c.id as number;
  }

  private async limpar(): Promise<void> {
    if (this.manter) {
      console.log(`ℹ --manter: agendamentos ${this.criados.agendamentos.join(', ')} mantidos.`);
      return;
    }
    for (const id of this.criados.agendamentos) {
      const l = await this.repo.findByAgendamento(id);
      if (l) await this.repo.softDelete(l.id as number);
      await this.agendamentos.update(id, { status: 'CANCELADO' });
      await this.agendamentos.softDelete(id);
    }
    for (const id of this.criados.clientes) await this.clientes.softDelete(id);
    console.log(`ℹ Limpeza: agendamentos ${this.criados.agendamentos.join(', ')}, seus lembretes e o cliente de teste inativados.`);
  }

  private check(condicao: boolean, descricao: string): void {
    console.log(`${condicao ? '✔' : '✖'} ${descricao}`);
    if (!condicao) this.falhas++;
  }
}

async function main(): Promise<void> {
  try {
    const ok = await new TesteLembretes(process.argv.includes('--manter')).executar();
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error('✖ Erro inesperado:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await Database.getInstance().close();
  }
}

void main();
