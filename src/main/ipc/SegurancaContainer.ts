import { Database } from '../core/database/Database';
import { UsuarioRepository } from '../core/repositories';
import { AuthorizationService, IpcGuard, SessionManager } from '../core/security';
import { AuthService, BcryptSenhaHasher, UsuarioService } from '../core/services';

/**
 * Monta os serviços de autenticação/autorização. A sessão é o Singleton
 * SessionManager, compartilhado por todos os handlers via `guard`.
 */
export class SegurancaContainer {
  public readonly sessao: SessionManager;
  public readonly authz: AuthorizationService;
  public readonly guard: IpcGuard;

  private _auth: AuthService | null = null;
  private _usuarios: UsuarioService | null = null;

  constructor(sessao: SessionManager = SessionManager.getInstance()) {
    this.sessao = sessao;
    this.authz = new AuthorizationService(sessao);
    this.guard = new IpcGuard(this.authz);
  }

  /** Criação preguiçosa: o banco só é acessado no primeiro uso. */
  public get auth(): AuthService {
    this._auth ??= new AuthService(new UsuarioRepository(Database.getInstance()), new BcryptSenhaHasher(), this.sessao);
    return this._auth;
  }

  public get usuarios(): UsuarioService {
    this._usuarios ??= new UsuarioService(new UsuarioRepository(Database.getInstance()), new BcryptSenhaHasher());
    return this._usuarios;
  }
}
