import type { CanalAuth, UsuarioSessaoDTO } from '../../shared/dtos';
import { UsuarioSessao, permissoesDoPerfil } from '../core/security';
import { IpcEntradaAuth } from './IpcEntradaAuth';
import { IpcRegistrar } from './IpcRegistrar';
import { SegurancaContainer } from './SegurancaContainer';

/** Canais `auth:*` (login/logout são os únicos canais acessíveis sem sessão). */
export class AuthIpcHandler {
  constructor(
    private readonly seguranca: SegurancaContainer,
    private readonly ipc: IpcRegistrar,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalAuth, fn: (payload: unknown) => Promise<T>) => this.ipc.handle(canal, fn);
    const s = this.seguranca;

    handle('auth:login', async (p) => {
      const { login, senha } = IpcEntradaAuth.login(p);
      return this.paraDTO(await s.auth.login(login, senha));
    });
    handle('auth:logout', async () => {
      s.sessao.logout();
    });
    handle('auth:usuarioAtual', async () => {
      const usuario = s.sessao.getUsuarioAtual();
      return usuario ? this.paraDTO(usuario) : null;
    });
    handle(
      'auth:trocarSenha',
      s.guard.autenticado(async (p) => {
        const { senhaAtual, novaSenha } = IpcEntradaAuth.trocarSenha(p);
        await s.auth.trocarSenha(senhaAtual, novaSenha);
      }),
    );
  }

  private paraDTO(usuario: UsuarioSessao): UsuarioSessaoDTO {
    return {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      perfil: usuario.perfil,
      especialidade: usuario.especialidade,
      permissoes: permissoesDoPerfil(usuario.perfil),
      expiraEm: (this.seguranca.sessao.expiraEm() ?? new Date()).toISOString(),
    };
  }
}
