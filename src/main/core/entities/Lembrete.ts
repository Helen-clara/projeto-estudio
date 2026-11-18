import type { CanalLembreteValor, StatusLembreteValor } from '../../../shared/lembretes';
import { ConflictError, ValidacaoCampos } from './DomainErrors';

/** Prefixo gravado em `erro` quando o envio foi simulado (a tabela não tem status próprio para isso). */
export const MARCA_SIMULACAO = 'SIMULADO:';

export interface LembreteProps {
  agendamentoId: number;
  canal: CanalLembreteValor;
  destinatario: string | null;
  status: StatusLembreteValor;
  tentativas: number;
  agendadoPara: Date;
  enviadoEm: Date | null;
  erro: string | null;
}

/**
 * Lembrete de um agendamento (1 por agendamento e canal).
 * Ciclo: PENDENTE → ENVIADO, ou PENDENTE → FALHA → (nova tentativa) → ENVIADO/FALHA,
 * até o limite de tentativas. Reenvio manual volta para PENDENTE com contador zerado.
 */
export class Lembrete {
  private _props: LembreteProps;

  private constructor(
    private readonly _id: number | null,
    props: LembreteProps,
    private readonly _ativo: boolean,
  ) {
    this._props = props;
  }

  public static criarPendente(agendamentoId: number, agendadoPara: Date, destinatario: string | null): Lembrete {
    new ValidacaoCampos()
      .check(Number.isInteger(agendamentoId) && agendamentoId > 0, 'agendamentoId', 'Agendamento inválido.')
      .check(agendadoPara instanceof Date && !Number.isNaN(agendadoPara.getTime()), 'agendadoPara', 'Data inválida.')
      .check((destinatario?.length ?? 0) <= 150, 'destinatario', 'Destinatário muito longo.')
      .throwIfAny();
    return new Lembrete(
      null,
      { agendamentoId, canal: 'EMAIL', destinatario, status: 'PENDENTE', tentativas: 0, agendadoPara, enviadoEm: null, erro: null },
      true,
    );
  }

  public static restaurar(id: number, props: LembreteProps, ativo: boolean): Lembrete {
    return new Lembrete(id, props, ativo);
  }

  public get id(): number | null { return this._id; }
  public get agendamentoId(): number { return this._props.agendamentoId; }
  public get canal(): CanalLembreteValor { return this._props.canal; }
  public get destinatario(): string | null { return this._props.destinatario; }
  public get status(): StatusLembreteValor { return this._props.status; }
  public get tentativas(): number { return this._props.tentativas; }
  public get agendadoPara(): Date { return new Date(this._props.agendadoPara); }
  public get enviadoEm(): Date | null { return this._props.enviadoEm ? new Date(this._props.enviadoEm) : null; }
  public get erro(): string | null { return this._props.erro; }
  public get ativo(): boolean { return this._ativo; }
  public get simulado(): boolean { return this.status === 'ENVIADO' && (this.erro?.startsWith(MARCA_SIMULACAO) ?? false); }

  /** Ainda pode ser enviado automaticamente? */
  public podeTentar(maxTentativas: number): boolean {
    return this._ativo && this.status !== 'ENVIADO' && this.tentativas < maxTentativas;
  }

  public registrarEnvio(agora: Date, destinatario: string, simulado: boolean): void {
    if (this.status === 'ENVIADO') throw new ConflictError('Lembrete já foi enviado.');
    this._props = {
      ...this._props,
      destinatario,
      status: 'ENVIADO',
      tentativas: this._props.tentativas + 1,
      enviadoEm: agora,
      erro: simulado ? `${MARCA_SIMULACAO} SMTP não configurado; mensagem registrada apenas no log.` : null,
    };
  }

  public registrarFalha(motivo: string, destinatario: string | null, definitiva = false, maxTentativas = 3): void {
    this._props = {
      ...this._props,
      destinatario,
      status: 'FALHA',
      // Falha definitiva (ex.: cliente sem e-mail) esgota as tentativas: não adianta repetir.
      tentativas: definitiva ? Math.max(maxTentativas, this._props.tentativas + 1) : this._props.tentativas + 1,
      erro: motivo.slice(0, 500),
    };
  }

  /** Reenvio manual: volta a PENDENTE e zera o contador. */
  public reabrir(): void {
    this._props = { ...this._props, status: 'PENDENTE', tentativas: 0, erro: null, enviadoEm: null };
  }

  public toProps(): LembreteProps {
    return { ...this._props };
  }
}
