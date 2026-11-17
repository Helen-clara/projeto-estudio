/**
 * Tipos, enums e DTOs compartilhados entre main, preload e renderer.
 * Fonte oficial do escopo: docs/CONTEXTO.md.
 */

/** Perfis de acesso (RBAC). */
export enum Perfil {
  ADMIN = 'ADMIN',
  RECEPCAO = 'RECEPCAO',
  PROFISSIONAL = 'PROFISSIONAL',
}

/** Especialidade de usuários com perfil PROFISSIONAL. */
export enum Especialidade {
  TATUADOR = 'TATUADOR',
  ESTETICISTA = 'ESTETICISTA',
}

/** Ciclo de vida de um agendamento. */
export enum StatusAgendamento {
  AGENDADO = 'AGENDADO',
  CONFIRMADO = 'CONFIRMADO',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
  FALTOU = 'FALTOU',
}

/** Categoria de serviços (e também de materiais do estoque). */
export enum CategoriaServico {
  TATUAGEM = 'TATUAGEM',
  ESTETICA = 'ESTETICA',
}

/** Envelope padrão de resposta trafegado via IPC. */
export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};
