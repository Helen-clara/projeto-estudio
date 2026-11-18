import type { StatusAgendamentoValor } from '../../../shared/agenda';
import { ConflictError, ValidacaoCampos, ValidationError, textoOpcional } from './DomainErrors';

/**
 * Conversões de data/hora no horário LOCAL do estúdio (sem fuso), no formato
 * usado entre telas e main: 'AAAA-MM-DDTHH:mm[:ss]' e 'AAAA-MM-DD'.
 */
export class DataHora {
  /** 'AAAA-MM-DDTHH:mm' ou 'AAAA-MM-DD HH:mm[:ss]' → Date local; null se inválida. */
  public static parse(valor: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec((valor ?? '').trim());
    if (!m) return null;
    const [ano, mes, dia, hora, min, seg] = m.slice(1).map((v) => Number(v ?? 0));
    const d = new Date(ano, mes - 1, dia, hora, min, seg);
    const ok = d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia &&
      d.getHours() === hora && d.getMinutes() === min;
    return ok ? d : null;
  }

  /** 'AAAA-MM-DD' → início do dia local; null se inválida. */
  public static parseData(valor: string): Date | null {
    return /^\d{4}-\d{2}-\d{2}$/.test((valor ?? '').trim()) ? DataHora.parse(`${valor.trim()}T00:00`) : null;
  }

  public static formatar(d: Date): string {
    return `${DataHora.formatarData(d)}T${DataHora.dois(d.getHours())}:${DataHora.dois(d.getMinutes())}:${DataHora.dois(d.getSeconds())}`;
  }

  public static formatarData(d: Date): string {
    return `${d.getFullYear()}-${DataHora.dois(d.getMonth() + 1)}-${DataHora.dois(d.getDate())}`;
  }

  /** Data/hora legível em pt-BR: 'dd/mm/aaaa às HH:mm'. */
  public static legivel(d: Date): string {
    return `${DataHora.dois(d.getDate())}/${DataHora.dois(d.getMonth() + 1)}/${d.getFullYear()} às ${DataHora.dois(d.getHours())}:${DataHora.dois(d.getMinutes())}`;
  }

  public static somarMinutos(d: Date, minutos: number): Date {
    return new Date(d.getTime() + minutos * 60_000);
  }

  private static dois(n: number): string {
    return String(n).padStart(2, '0');
  }
}

export interface AgendamentoProps {
  clienteId: number;
  profissionalId: number;
  servicoId: number;
  inicio: Date;
  fim: Date;
  status: StatusAgendamentoValor;
  valorCobrado: number | null;
  observacoes: string | null;
}

export interface NovoAgendamento {
  clienteId: number;
  profissionalId: number;
  servicoId: number;
  inicio: Date;
  duracaoMinutos: number;
  observacoes?: string | null;
}

/**
 * Transições permitidas:
 *   AGENDADO → CONFIRMADO → CONCLUIDO
 *   AGENDADO | CONFIRMADO → CANCELADO | FALTOU
 * CONCLUIDO, CANCELADO e FALTOU são estados finais.
 */
const TRANSICOES: Readonly<Record<StatusAgendamentoValor, readonly StatusAgendamentoValor[]>> = {
  AGENDADO: ['CONFIRMADO', 'CANCELADO', 'FALTOU'],
  CONFIRMADO: ['CONCLUIDO', 'CANCELADO', 'FALTOU'],
  CONCLUIDO: [],
  CANCELADO: [],
  FALTOU: [],
};

const ROTULOS: Readonly<Record<StatusAgendamentoValor, string>> = {
  AGENDADO: 'agendado',
  CONFIRMADO: 'confirmado',
  CONCLUIDO: 'concluído',
  CANCELADO: 'cancelado',
  FALTOU: 'marcado como falta',
};

const VALOR_MAXIMO = 99_999_999.99;

/** Sessão marcada na agenda de um profissional; quando CONCLUIDO, é o registro do histórico. */
export class Agendamento {
  private _props: AgendamentoProps;

  private constructor(
    private readonly _id: number | null,
    props: AgendamentoProps,
    private readonly _ativo: boolean,
  ) {
    this._props = props;
  }

  public static criar(dados: NovoAgendamento): Agendamento {
    const props = Agendamento.montar(dados, 'AGENDADO');
    return new Agendamento(null, props, true);
  }

  public static restaurar(id: number, props: AgendamentoProps, ativo: boolean): Agendamento {
    return new Agendamento(id, props, ativo);
  }

  public static isStatus(valor: unknown): valor is StatusAgendamentoValor {
    return typeof valor === 'string' && valor in TRANSICOES;
  }

  public static podeTransitar(de: StatusAgendamentoValor, para: StatusAgendamentoValor): boolean {
    return TRANSICOES[de].includes(para);
  }

  public get id(): number | null { return this._id; }
  public get clienteId(): number { return this._props.clienteId; }
  public get profissionalId(): number { return this._props.profissionalId; }
  public get servicoId(): number { return this._props.servicoId; }
  public get inicio(): Date { return new Date(this._props.inicio); }
  public get fim(): Date { return new Date(this._props.fim); }
  public get status(): StatusAgendamentoValor { return this._props.status; }
  public get valorCobrado(): number | null { return this._props.valorCobrado; }
  public get observacoes(): string | null { return this._props.observacoes; }
  public get ativo(): boolean { return this._ativo; }

  /** Ainda pode ser alterado (remarcado, confirmado, cancelado...). */
  public get emAberto(): boolean {
    return this.status === 'AGENDADO' || this.status === 'CONFIRMADO';
  }

  /** Altera cliente/profissional/serviço/horário. Só para agendamentos em aberto. */
  public remarcar(dados: NovoAgendamento): void {
    this.exigirEmAberto('editar');
    this._props = { ...Agendamento.montar(dados, this.status), valorCobrado: null };
  }

  public confirmar(): void {
    this.transitar('CONFIRMADO');
  }

  /** Conclui (exige CONFIRMADO) e grava o valor efetivamente cobrado. */
  public concluir(valorCobrado: number, agora: Date, observacoes?: string | null): void {
    this.exigirTransicao('CONCLUIDO');
    new ValidacaoCampos()
      .check(
        Number.isFinite(valorCobrado) && valorCobrado >= 0 && valorCobrado <= VALOR_MAXIMO &&
          Math.abs(Math.round(valorCobrado * 100) - valorCobrado * 100) < 1e-6,
        'valorCobrado',
        'Valor cobrado deve ser maior ou igual a zero, com até 2 casas decimais.',
      )
      .throwIfAny();
    if (this._props.inicio.getTime() > agora.getTime()) {
      throw new ConflictError('O atendimento ainda não começou: só é possível concluir a partir do horário marcado.');
    }
    this.transitar('CONCLUIDO');
    this._props.valorCobrado = Math.round(valorCobrado * 100) / 100;
    const obs = textoOpcional(observacoes);
    if (obs) this._props.observacoes = Agendamento.juntarObservacao(this._props.observacoes, obs);
  }

  public cancelar(motivo?: string | null): void {
    this.transitar('CANCELADO');
    const m = textoOpcional(motivo);
    if (m) this._props.observacoes = Agendamento.juntarObservacao(this._props.observacoes, `Cancelamento: ${m}`);
  }

  public marcarFalta(agora: Date): void {
    this.exigirTransicao('FALTOU');
    if (this._props.inicio.getTime() > agora.getTime()) {
      throw new ConflictError('Só é possível marcar falta depois do horário marcado.');
    }
    this.transitar('FALTOU');
  }

  public toProps(): AgendamentoProps {
    return { ...this._props, inicio: this.inicio, fim: this.fim };
  }

  private transitar(para: StatusAgendamentoValor): void {
    this.exigirTransicao(para);
    this._props.status = para;
  }

  /** Lança erro de domínio se a transição não for permitida (não altera o estado). */
  private exigirTransicao(para: StatusAgendamentoValor): void {
    if (!Agendamento.podeTransitar(this.status, para)) {
      throw new ConflictError(
        `Transição inválida: um agendamento ${ROTULOS[this.status]} não pode ser ${ROTULOS[para]}.` +
          (para === 'CONCLUIDO' && this.status === 'AGENDADO' ? ' Confirme o agendamento antes de concluir.' : ''),
      );
    }
  }

  private exigirEmAberto(acao: string): void {
    if (!this.emAberto) {
      throw new ConflictError(`Não é possível ${acao}: o agendamento está ${ROTULOS[this.status]}.`);
    }
  }

  private static juntarObservacao(atual: string | null, nova: string): string {
    const texto = atual ? `${atual}\n${nova}` : nova;
    return texto.slice(0, 2000);
  }

  private static montar(d: NovoAgendamento, status: StatusAgendamentoValor): AgendamentoProps {
    const observacoes = textoOpcional(d.observacoes);
    const inicioValido = d.inicio instanceof Date && !Number.isNaN(d.inicio.getTime());
    new ValidacaoCampos()
      .check(Number.isInteger(d.clienteId) && d.clienteId > 0, 'clienteId', 'Cliente inválido.')
      .check(Number.isInteger(d.profissionalId) && d.profissionalId > 0, 'profissionalId', 'Profissional inválido.')
      .check(Number.isInteger(d.servicoId) && d.servicoId > 0, 'servicoId', 'Serviço inválido.')
      .check(inicioValido, 'inicio', 'Data/hora de início inválida.')
      .check((observacoes?.length ?? 0) <= 2000, 'observacoes', 'Observações muito longas (máx. 2000).')
      .throwIfAny();
    if (!Number.isInteger(d.duracaoMinutos) || d.duracaoMinutos <= 0) {
      throw new ValidationError('Duração do serviço inválida.');
    }
    const inicio = new Date(d.inicio);
    inicio.setSeconds(0, 0);
    return {
      clienteId: d.clienteId,
      profissionalId: d.profissionalId,
      servicoId: d.servicoId,
      inicio,
      fim: DataHora.somarMinutos(inicio, d.duracaoMinutos),
      status,
      valorCobrado: null,
      observacoes,
    };
  }
}
