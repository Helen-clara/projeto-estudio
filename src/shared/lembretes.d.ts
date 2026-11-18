/**
 * Tipos dos lembretes automáticos (e-mail um dia antes do agendamento).
 * Arquivo só de tipos (.d.ts) para ser usado também pelo renderer.
 */
import type { PaginaDTO } from './dtos';

export type StatusLembreteValor = 'PENDENTE' | 'ENVIADO' | 'FALHA';
export type CanalLembreteValor = 'EMAIL';

export interface LembreteDTO {
  id: number;
  agendamentoId: number;
  canal: CanalLembreteValor;
  destinatario: string | null;
  status: StatusLembreteValor;
  /** true quando "enviado" em modo simulação (SMTP não configurado). */
  simulado: boolean;
  tentativas: number;
  /** 'AAAA-MM-DDTHH:mm:ss' (horário local) */
  agendadoPara: string;
  enviadoEm: string | null;
  erro: string | null;
  ativo: boolean;
  // Dados do agendamento, para a lista
  clienteNome: string;
  profissionalNome: string;
  servicoNome: string;
  inicioAgendamento: string;
}

export interface FiltroLembretes {
  status?: StatusLembreteValor;
  agendamentoId?: number;
  /** 'AAAA-MM-DD' — data do agendamento (inclusive) */
  dataInicio?: string;
  dataFim?: string;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export type PaginaLembretesDTO = PaginaDTO<LembreteDTO>;

export interface ResultadoLembreteDTO {
  agendamentoId: number;
  lembreteId: number | null;
  resultado: 'ENVIADO' | 'ENVIADO_SIMULADO' | 'FALHA' | 'IGNORADO';
  motivo?: string;
}

export interface ResumoProcessamentoDTO {
  /** 'AAAA-MM-DDTHH:mm:ss' */
  executadoEm: string;
  verificados: number;
  enviados: number;
  simulados: number;
  falhas: number;
  ignorados: number;
  /** true se já havia um processamento em andamento (nada foi feito). */
  emAndamento: boolean;
  detalhes: ResultadoLembreteDTO[];
}

export type CanalLembretes =
  | 'lembretes:listar'
  | 'lembretes:reenviar'
  | 'lembretes:excluir'
  | 'lembretes:rodarAgora';
