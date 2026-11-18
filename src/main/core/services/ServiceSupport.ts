import type { PaginaDTO } from '../../../shared/dtos';
import { Page } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { ConflictError } from '../entities';

/** Executa trabalho numa transação (implementado por Database). */
export interface UnidadeDeTrabalho {
  transaction<R>(callback: (tx: SqlExecutor) => Promise<R>): Promise<R>;
}

/** Converte uma página de entidades em página de DTOs. */
export function paginaDTO<E, D>(page: Page<E>, toDTO: (e: E) => D): PaginaDTO<D> {
  return { items: page.items.map(toDTO), total: page.total, limit: page.limit, offset: page.offset };
}

/** true quando o erro é violação de UNIQUE do MySQL. */
export function isChaveDuplicada(error: unknown): boolean {
  return (error as { code?: string })?.code === 'ER_DUP_ENTRY';
}

/**
 * Executa a gravação convertendo violação de UNIQUE (ex.: duas telas salvando ao
 * mesmo tempo, passando pela checagem prévia) em ConflictError com mensagem amigável.
 */
export async function gravarComUnicidade<T>(acao: () => Promise<T>, mensagemConflito: string): Promise<T> {
  try {
    return await acao();
  } catch (error) {
    if (isChaveDuplicada(error)) throw new ConflictError(mensagemConflito);
    throw error;
  }
}
