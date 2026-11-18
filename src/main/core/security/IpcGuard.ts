import { AuthorizationService } from './AuthorizationService';
import { Permissao } from './Permissao';
import { UsuarioSessao } from './SessionManager';

/** Handler IPC que também recebe o usuário logado (ex.: para filtrar "minha agenda"). */
export type HandlerProtegido<T> = (payload: unknown, usuario: UsuarioSessao) => Promise<T>;

/**
 * Middleware para handlers IPC: checa sessão e permissão ANTES de executar.
 *
 *   ipc.handle('clientes:salvar', guard.exigir(Permissao.CLIENTES_EDITAR, (p) => ...));
 *
 * Sem sessão → UnauthorizedError; sem permissão → ForbiddenError. O IpcRegistrar
 * converte esses erros em `{ ok: false, error }` para o renderer.
 */
export class IpcGuard {
  constructor(private readonly authz: AuthorizationService = new AuthorizationService()) {}

  /** Exige a permissão informada. */
  public exigir<T>(permissao: Permissao, handler: HandlerProtegido<T>): (payload: unknown) => Promise<T> {
    return async (payload) => handler(payload, this.authz.exigir(permissao));
  }

  /** Exige pelo menos uma das permissões. */
  public exigirAlguma<T>(permissoes: Permissao[], handler: HandlerProtegido<T>): (payload: unknown) => Promise<T> {
    return async (payload) => handler(payload, this.authz.exigirAlguma(...permissoes));
  }

  /** Só exige estar logado. */
  public autenticado<T>(handler: HandlerProtegido<T>): (payload: unknown) => Promise<T> {
    return async (payload) => handler(payload, this.authz.exigirSessao());
  }
}
