import { ipcMain } from 'electron';
import type { ApiResult } from '../../shared/dtos';
import { DatabaseConfigError } from '../core/database/Database';
import { RepositoryError } from '../core/database/BaseRepository';
import { DomainError } from '../core/entities';

/** Códigos de erro do mysql2/rede que significam "banco fora do ar". */
const ERROS_CONEXAO = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR']);

/**
 * Registra handlers IPC que sempre respondem `{ ok, data?, error? }`.
 * Erros esperados (domínio/validação) viram mensagem amigável; erros
 * inesperados são registrados no console do main (sem o payload, para não
 * vazar dados pessoais) e o renderer recebe só uma mensagem genérica.
 */
export class IpcRegistrar {
  private readonly canais: string[] = [];

  public handle<C extends string, T>(canal: C, handler: (payload: unknown) => Promise<T>): void {
    ipcMain.handle(canal, async (_event, payload: unknown): Promise<ApiResult<T>> => {
      try {
        const data = await handler(payload);
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: IpcRegistrar.mensagem(canal, error) };
      }
    });
    this.canais.push(canal);
  }

  /** Remove todos os handlers registrados por esta instância. */
  public removerTodos(): void {
    this.canais.forEach((c) => ipcMain.removeHandler(c));
    this.canais.length = 0;
  }

  public static mensagem(canal: string, error: unknown): string {
    if (error instanceof DomainError || error instanceof RepositoryError) {
      return error.message;
    }
    if (error instanceof DatabaseConfigError) {
      return `Banco de dados não configurado: ${error.message}`;
    }
    const code = (error as { code?: string })?.code;
    if (code && ERROS_CONEXAO.has(code)) {
      console.error(`[ipc] ${canal}: banco indisponível (${code})`);
      return 'Banco de dados indisponível. Verifique a conexão e tente novamente.';
    }
    console.error(`[ipc] ${canal}: erro inesperado`, code ?? '', (error as Error)?.message ?? error);
    return 'Erro interno ao processar a solicitação.';
  }
}
