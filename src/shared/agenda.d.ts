/**
 * Tipos da agenda, do histórico de atendimentos e das estatísticas.
 * Arquivo só de tipos (.d.ts) para ser usado também pelo renderer.
 *
 * Datas/horas trafegam como texto no horário LOCAL do estúdio, sem fuso:
 *   data e hora: 'AAAA-MM-DDTHH:mm' (entrada) / 'AAAA-MM-DDTHH:mm:ss' (saída)
 *   data:        'AAAA-MM-DD'
 */
import type { CategoriaValor, PaginaDTO } from './dtos';

export type StatusAgendamentoValor = 'AGENDADO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO' | 'FALTOU';

// ---------------------------------------------------------------- Agenda

export interface AgendamentoInput {
  clienteId: number;
  profissionalId: number;
  servicoId: number;
  /** 'AAAA-MM-DDTHH:mm' (horário local). O fim é calculado pela duração do serviço. */
  inicio: string;
  observacoes?: string | null;
  /** Marque true para salvar mesmo caindo em feriado nacional (depois de ver o aviso). */
  confirmarFeriado?: boolean;
}

export interface AgendamentoDTO {
  id: number;
  clienteId: number;
  clienteNome: string;
  profissionalId: number;
  profissionalNome: string;
  servicoId: number;
  servicoNome: string;
  servicoCategoria: CategoriaValor;
  inicio: string;
  fim: string;
  status: StatusAgendamentoValor;
  valorCobrado: number | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface AgendamentoSalvoDTO {
  /** null quando o horário cai em feriado e `confirmarFeriado` não foi enviado. */
  agendamento: AgendamentoDTO | null;
  /** true = nada foi salvo; reenvie com `confirmarFeriado: true` para confirmar. */
  requerConfirmacao: boolean;
  avisos: string[];
}

export interface FiltroAgenda {
  profissionalId?: number;
  clienteId?: number;
  /** 'AAAA-MM-DD' (inclusive) */
  dataInicio?: string;
  /** 'AAAA-MM-DD' (inclusive) */
  dataFim?: string;
  status?: StatusAgendamentoValor[];
  /** true (padrão) = só registros não excluídos. */
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export interface EditarAgendamentoPayload {
  id: number;
  dados: AgendamentoInput;
}

export interface CancelarAgendamentoPayload {
  id: number;
  motivo?: string | null;
}

export interface ConcluirAgendamentoPayload {
  id: number;
  /** Valor efetivamente cobrado (BRL). Se omitido, usa o preço atual do serviço. */
  valorCobrado?: number | null;
  observacoes?: string | null;
}

// ---------------------------------------------------------------- Histórico

export interface AtendimentoDTO {
  agendamentoId: number;
  data: string;
  clienteId: number;
  clienteNome: string;
  profissionalId: number;
  profissionalNome: string;
  servicoId: number;
  servicoNome: string;
  servicoCategoria: CategoriaValor;
  valorCobrado: number;
}

export interface FiltroHistorico {
  clienteId?: number;
  profissionalId?: number;
  dataInicio?: string;
  dataFim?: string;
  limit?: number;
  offset?: number;
}

export interface HistoricoDTO extends PaginaDTO<AtendimentoDTO> {
  /** Soma de valorCobrado de TODOS os atendimentos do filtro (não só da página). */
  valorTotal: number;
}

// ---------------------------------------------------------------- Estatísticas

export interface PeriodoPayload {
  /** 'AAAA-MM-DD' */
  dataInicio: string;
  /** 'AAAA-MM-DD' */
  dataFim: string;
}

export interface ContagemValorDTO {
  chave: string;
  rotulo: string;
  atendimentos: number;
  faturamento: number;
}

export interface EstatisticasResumoDTO {
  periodo: PeriodoPayload;
  atendimentosConcluidos: number;
  faturamento: number;
  ticketMedio: number;
  porMes: ContagemValorDTO[];
  porServico: ContagemValorDTO[];
  porProfissional: ContagemValorDTO[];
  /** Agendamentos com início no período, por status. */
  porStatus: Record<StatusAgendamentoValor, number>;
  /** Percentuais (0–100) sobre agendamentos encerrados (concluído + cancelado + faltou). */
  taxaCancelamento: number;
  taxaFalta: number;
  clientesNovos: number;
  clientesRecorrentes: number;
}

// ---------------------------------------------------------------- Canais IPC

export type CanalAgenda =
  | 'agenda:listar'
  | 'agenda:obter'
  | 'agenda:criar'
  | 'agenda:editar'
  | 'agenda:confirmar'
  | 'agenda:cancelar'
  | 'agenda:concluir'
  | 'agenda:marcarFalta'
  | 'agenda:excluir'
  | 'agenda:verificarFeriado'
  | 'historico:porCliente'
  | 'historico:porProfissional'
  | 'historico:porPeriodo'
  | 'estatisticas:resumo';
