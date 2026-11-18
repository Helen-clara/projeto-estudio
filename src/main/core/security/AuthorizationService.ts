import { PERMISSOES_POR_PERFIL, Permissao } from './Permissao';
import { ForbiddenError, UnauthorizedError } from './SecurityErrors';
import { SessionManager, UsuarioSessao } from './SessionManager';

/** Verifica sessão e permissões do usuário logado. */
export class AuthorizationService {
  constructor(private readonly sessao: SessionManager = SessionManager.getInstance()) {}

  /** Usuário logado (renova a sessão) ou UnauthorizedError. */
  public exigirSessao(): UsuarioSessao {
    const usuario = this.sessao.getUsuarioAtual();
    if (!usuario) throw new UnauthorizedError();
    this.sessao.tocar();
    return usuario;
  }

  /** Lança UnauthorizedError sem sessão e ForbiddenError sem a permissão. */
  public exigir(permissao: Permissao): UsuarioSessao {
    const usuario = this.exigirSessao();
    if (!AuthorizationService.perfilPossui(usuario, permissao)) {
      throw new ForbiddenError();
    }
    return usuario;
  }

  /** Exige pelo menos uma das permissões (ex.: ver agenda de todos OU a própria). */
  public exigirAlguma(...permissoes: Permissao[]): UsuarioSessao {
    const usuario = this.exigirSessao();
    if (!permissoes.some((p) => AuthorizationService.perfilPossui(usuario, p))) {
      throw new ForbiddenError();
    }
    return usuario;
  }

  public possui(permissao: Permissao): boolean {
    const usuario = this.sessao.getUsuarioAtual();
    return usuario !== null && AuthorizationService.perfilPossui(usuario, permissao);
  }

  private static perfilPossui(usuario: UsuarioSessao, permissao: Permissao): boolean {
    return PERMISSOES_POR_PERFIL[usuario.perfil]?.has(permissao) ?? false;
  }
}
