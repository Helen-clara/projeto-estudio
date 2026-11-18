import type { AgendamentoDTO, AgendamentoInput, AgendamentoSalvoDTO } from '../../../shared/agenda';
import type { PaginaDTO } from '../../../shared/dtos';
import { FeriadosClient, ConsultaFeriado } from '../../integrations/FeriadosClient';
import { SqlExecutor } from '../database/Database';
import { ConflictError, NotFoundError, ValidationError } from '../entities';
import { Agendamento, DataHora } from '../entities/Agendamento';
import {
  AgendamentoDetalhado,
  AgendamentoRepository,
  BuscaAgendamentos,
  ClienteRepository,
  ProfissionalRepository,
  ServicoRepository,
} from '../repositories';
import { UnidadeDeTrabalho, paginaDTO } from './ServiceSupport';

const NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * Horário de funcionamento do estúdio. Configurável no .env:
 *   HORARIO_ABERTURA=09:00  HORARIO_FECHAMENTO=20:00  DIAS_FUNCIONAMENTO=1,2,3,4,5,6 (0 = domingo)
 */
export class HorarioFuncionamento {
  constructor(
    /** Minutos desde 00:00. */
    public readonly abertura: number,
    public readonly fechamento: number,
    public readonly dias: ReadonlySet<number>,
  ) {
    if (!(abertura >= 0 && fechamento <= 24 * 60 && abertura < fechamento) || dias.size === 0) {
      throw new Error('Horário de funcionamento inválido.');
    }
  }

  public static padrao(): HorarioFuncionamento {
    return new HorarioFuncionamento(9 * 60, 20 * 60, new Set([1, 2, 3, 4, 5, 6]));
  }

  /** Lê do .env; valores ausentes ou inválidos usam o padrão (09h–20h, seg–sáb). */
  public static doAmbiente(env: NodeJS.ProcessEnv = process.env): HorarioFuncionamento {
    const p = HorarioFuncionamento.padrao();
    const abertura = HorarioFuncionamento.minutos(env.HORARIO_ABERTURA) ?? p.abertura;
    const fechamento = HorarioFuncionamento.minutos(env.HORARIO_FECHAMENTO) ?? p.fechamento;
    const dias = (env.DIAS_FUNCIONAMENTO ?? '')
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    try {
      return new HorarioFuncionamento(abertura, fechamento, dias.length > 0 ? new Set(dias) : p.dias);
    } catch {
      return p;
    }
  }

  /** Mensagem do problema, ou null se [inicio, fim) está dentro do expediente. */
  public problema(inicio: Date, fim: Date): string | null {
    if (!this.dias.has(inicio.getDay())) {
      return `O estúdio não funciona neste dia (${NOMES_DIAS[inicio.getDay()]}). Dias de funcionamento: ${this.descreverDias()}.`;
    }
    const mesmoDia = DataHora.formatarData(inicio) === DataHora.formatarData(new Date(fim.getTime() - 1));
    const ini = inicio.getHours() * 60 + inicio.getMinutes();
    const fimMin = mesmoDia ? fim.getHours() * 60 + fim.getMinutes() || 24 * 60 : Infinity;
    if (ini < this.abertura || fimMin > this.fechamento) {
      return `Fora do horário de funcionamento (${HorarioFuncionamento.hhmm(this.abertura)}–${HorarioFuncionamento.hhmm(this.fechamento)}): o atendimento iria de ${HorarioFuncionamento.hhmm(ini)} até ${mesmoDia ? HorarioFuncionamento.hhmm(fimMin) : 'o dia seguinte'}.`;
    }
    return null;
  }

  private descreverDias(): string {
    return [...this.dias].sort().map((d) => NOMES_DIAS[d]).join(', ');
  }

  private static minutos(valor: string | undefined): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec((valor ?? '').trim());
    if (!m) return null;
    const total = Number(m[1]) * 60 + Number(m[2]);
    return Number(m[2]) < 60 && total <= 24 * 60 ? total : null;
  }

  private static hhmm(minutos: number): string {
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  }
}

/** Dados de criação/edição já convertidos da entrada da tela. */
export interface DadosAgendamento {
  clienteId: number;
  profissionalId: number;
  servicoId: number;
  inicio: Date;
  observacoes: string | null;
  confirmarFeriado: boolean;
}

/** Regras da agenda: criação, remarcação e ciclo de vida dos agendamentos. */
export class AgendamentoService {
  constructor(
    private readonly agendamentos: AgendamentoRepository,
    private readonly clientes: ClienteRepository,
    private readonly profissionais: ProfissionalRepository,
    private readonly servicos: ServicoRepository,
    private readonly feriados: FeriadosClient,
    private readonly uow: UnidadeDeTrabalho,
    private readonly horario: HorarioFuncionamento = HorarioFuncionamento.doAmbiente(),
    private readonly relogio: () => Date = () => new Date(),
    private readonly repositoryEmTransacao: (tx: SqlExecutor) => AgendamentoRepository = (tx) =>
      new AgendamentoRepository(tx),
  ) {}

  public static toDTO(d: AgendamentoDetalhado): AgendamentoDTO {
    const a = d.agendamento;
    return {
      id: a.id as number,
      clienteId: a.clienteId,
      clienteNome: d.clienteNome,
      profissionalId: a.profissionalId,
      profissionalNome: d.profissionalNome,
      servicoId: a.servicoId,
      servicoNome: d.servicoNome,
      servicoCategoria: d.servicoCategoria,
      inicio: DataHora.formatar(a.inicio),
      fim: DataHora.formatar(a.fim),
      status: a.status,
      valorCobrado: a.valorCobrado,
      observacoes: a.observacoes,
      ativo: a.ativo,
    };
  }

  /** Converte a entrada da tela (texto) em dados tipados. */
  public static converterEntrada(input: AgendamentoInput): DadosAgendamento {
    const inicio = DataHora.parse(input.inicio);
    if (!inicio) {
      throw new ValidationError('Data/hora de início inválida (use AAAA-MM-DDTHH:mm).', { inicio: 'Data/hora inválida.' });
    }
    return {
      clienteId: input.clienteId,
      profissionalId: input.profissionalId,
      servicoId: input.servicoId,
      inicio,
      observacoes: input.observacoes ?? null,
      confirmarFeriado: input.confirmarFeriado === true,
    };
  }

  public async listar(busca: BuscaAgendamentos): Promise<PaginaDTO<AgendamentoDTO>> {
    return paginaDTO(await this.agendamentos.buscar(busca), AgendamentoService.toDTO);
  }

  public async obter(id: number): Promise<AgendamentoDTO> {
    return AgendamentoService.toDTO(await this.detalhadoOuFalhar(id));
  }

  /** Consulta avulsa de feriado (ex.: a tela avisar ao escolher a data). */
  public verificarFeriado(data: Date): Promise<ConsultaFeriado> {
    return this.feriados.consultar(data);
  }

  public async criar(dados: DadosAgendamento): Promise<AgendamentoSalvoDTO> {
    const { duracao, avisos } = await this.validarReferencias(dados);
    const novo = Agendamento.criar({ ...dados, duracaoMinutos: duracao });
    this.validarHorario(novo.inicio, novo.fim);

    const feriado = await this.checarFeriado(novo.inicio, dados.confirmarFeriado, avisos);
    if (feriado) return feriado;

    const id = await this.uow.transaction(async (tx) => {
      const repo = this.repositoryEmTransacao(tx);
      await this.bloquearAgendaDoProfissional(tx, novo.profissionalId);
      if (await repo.existeConflito(novo.profissionalId, novo.inicio, novo.fim)) {
        throw AgendamentoService.erroConflito();
      }
      return (await repo.create(novo.toProps())).id as number;
    });
    return { agendamento: await this.obter(id), requerConfirmacao: false, avisos };
  }

  /** Remarca/edita um agendamento em aberto (cliente, profissional, serviço, horário, observações). */
  public async editar(id: number, dados: DadosAgendamento): Promise<AgendamentoSalvoDTO> {
    const atual = await this.agendamentoOuFalhar(id);
    const { duracao, avisos } = await this.validarReferencias(dados);
    atual.remarcar({ ...dados, duracaoMinutos: duracao });
    this.validarHorario(atual.inicio, atual.fim);

    const feriado = await this.checarFeriado(atual.inicio, dados.confirmarFeriado, avisos);
    if (feriado) return feriado;

    await this.uow.transaction(async (tx) => {
      const repo = this.repositoryEmTransacao(tx);
      await this.bloquearAgendaDoProfissional(tx, atual.profissionalId);
      if (await repo.existeConflito(atual.profissionalId, atual.inicio, atual.fim, id)) {
        throw AgendamentoService.erroConflito();
      }
      await repo.update(id, atual.toProps());
    });
    return { agendamento: await this.obter(id), requerConfirmacao: false, avisos };
  }

  public async confirmar(id: number): Promise<AgendamentoDTO> {
    const a = await this.agendamentoOuFalhar(id);
    a.confirmar();
    return this.salvarEstado(id, a);
  }

  public async cancelar(id: number, motivo?: string | null): Promise<AgendamentoDTO> {
    const a = await this.agendamentoOuFalhar(id);
    a.cancelar(motivo);
    return this.salvarEstado(id, a);
  }

  public async marcarFalta(id: number): Promise<AgendamentoDTO> {
    const a = await this.agendamentoOuFalhar(id);
    a.marcarFalta(this.relogio());
    return this.salvarEstado(id, a);
  }

  /**
   * Conclui o atendimento e grava o valor cobrado (padrão: preço atual do serviço).
   * O agendamento CONCLUIDO é o registro do histórico de atendimentos.
   */
  public async concluir(id: number, valorCobrado?: number | null, observacoes?: string | null): Promise<AgendamentoDTO> {
    const a = await this.agendamentoOuFalhar(id);
    let valor = valorCobrado;
    if (valor === undefined || valor === null) {
      const servico = await this.servicos.findById(a.servicoId);
      if (!servico) throw new NotFoundError('Serviço', a.servicoId);
      valor = servico.preco;
    }
    a.concluir(valor, this.relogio(), observacoes);
    return this.salvarEstado(id, a);
  }

  /**
   * Exclusão lógica (some da agenda). Só para agendamentos cancelados ou com falta:
   * atendimentos concluídos são histórico e não podem ser excluídos; os em aberto devem ser cancelados.
   */
  public async excluir(id: number): Promise<void> {
    const a = await this.agendamentoOuFalhar(id);
    if (a.status !== 'CANCELADO' && a.status !== 'FALTOU') {
      throw new ConflictError(
        a.status === 'CONCLUIDO'
          ? 'Atendimentos concluídos fazem parte do histórico e não podem ser excluídos.'
          : 'Cancele o agendamento antes de excluí-lo.',
      );
    }
    await this.agendamentos.softDelete(id);
  }

  /** Para checagens de escopo (ex.: profissional só mexe na própria agenda). */
  public async profissionalDoAgendamento(id: number): Promise<number> {
    return (await this.agendamentoOuFalhar(id)).profissionalId;
  }

  // ------------------------------------------------------------- regras internas

  private async validarReferencias(dados: DadosAgendamento): Promise<{ duracao: number; avisos: string[] }> {
    const [cliente, profissional, servico] = await Promise.all([
      this.clientes.findById(dados.clienteId),
      this.profissionais.findById(dados.profissionalId),
      this.servicos.findById(dados.servicoId),
    ]);
    if (!cliente) throw new NotFoundError('Cliente', dados.clienteId);
    if (!profissional) throw new NotFoundError('Profissional', dados.profissionalId);
    if (!servico) throw new NotFoundError('Serviço', dados.servicoId);
    if (!cliente.ativo) throw new ConflictError('Cliente inativo: reative o cadastro antes de agendar.');
    if (!profissional.ativo) throw new ConflictError('Profissional inativo.');
    if (!servico.ativo) throw new ConflictError(`O serviço "${servico.nome}" está inativo.`);
    if (!(await this.agendamentos.profissionalHabilitado(profissional.id as number, servico.id as number))) {
      throw new ConflictError(`${profissional.nome} não está habilitado(a) para "${servico.nome}".`);
    }
    if (servico.categoria === 'TATUAGEM' && cliente.isMenorDeIdade(dados.inicio)) {
      throw new ValidationError('Cliente menor de 18 anos não pode realizar tatuagem.', { clienteId: 'Cliente menor de idade.' });
    }
    if (dados.inicio.getTime() <= this.relogio().getTime()) {
      throw new ValidationError('A data/hora do agendamento deve ser futura.', { inicio: 'Escolha um horário futuro.' });
    }
    return { duracao: servico.duracaoMinutos, avisos: [] };
  }

  private validarHorario(inicio: Date, fim: Date): void {
    const problema = this.horario.problema(inicio, fim);
    if (problema) throw new ValidationError(problema, { inicio: problema });
  }

  /** Devolve a resposta "requer confirmação" quando é feriado e o usuário ainda não confirmou. */
  private async checarFeriado(inicio: Date, confirmado: boolean, avisos: string[]): Promise<AgendamentoSalvoDTO | null> {
    const { feriado, verificado } = await this.feriados.consultar(inicio);
    if (!verificado) {
      avisos.push('Não foi possível verificar feriados nacionais agora (sem conexão com a BrasilAPI).');
      return null;
    }
    if (!feriado) return null;
    const texto = `${DataHora.formatarData(inicio).split('-').reverse().join('/')} é feriado nacional (${feriado}).`;
    if (!confirmado) {
      return { agendamento: null, requerConfirmacao: true, avisos: [...avisos, `${texto} Confirme para agendar mesmo assim.`] };
    }
    avisos.push(`${texto} Agendado com confirmação.`);
    return null;
  }

  /**
   * Trava a linha do profissional até o fim da transação: dois agendamentos
   * simultâneos para o mesmo profissional são verificados um de cada vez,
   * evitando que ambos passem pela checagem de conflito.
   */
  private async bloquearAgendaDoProfissional(tx: SqlExecutor, profissionalId: number): Promise<void> {
    await tx.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [profissionalId]);
  }

  private async salvarEstado(id: number, a: Agendamento): Promise<AgendamentoDTO> {
    const { status, valorCobrado, observacoes } = a.toProps();
    await this.agendamentos.update(id, { status, valorCobrado, observacoes });
    return this.obter(id);
  }

  private async agendamentoOuFalhar(id: number): Promise<Agendamento> {
    const a = await this.agendamentos.findById(id);
    if (!a || !a.ativo) throw new NotFoundError('Agendamento', id);
    return a;
  }

  private async detalhadoOuFalhar(id: number): Promise<AgendamentoDetalhado> {
    const d = await this.agendamentos.findDetalhadoById(id);
    if (!d) throw new NotFoundError('Agendamento', id);
    return d;
  }

  private static erroConflito(): ConflictError {
    return new ConflictError('Conflito de horário: o profissional já tem um agendamento nesse intervalo.');
  }
}
