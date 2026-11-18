import { NotFoundError, ValidationError } from '../entities';
import { UsuarioRepository } from '../repositories';
import { PoliticaSenha } from '../security/PoliticaSenha';
import { AuthenticationError, UnauthorizedError } from '../security/SecurityErrors';
import { SessionManager, UsuarioSessao } from '../security/SessionManager';
import { SenhaHasher } from './SenhaHasher';

export interface ConfiguracaoLogin {
  /** Tentativas erradas seguidas antes do bloqueio. */
  maxTentativas: number;
  /** Duração do bloqueio temporário. */
  minutosBloqueio: number;
}

/**
 * Hash bcrypt de uma senha aleatória descartada. Quando o login não existe, a
 * senha é comparada com ele mesmo assim, para que a resposta demore o mesmo
 * tempo e não revele quais logins existem.
 */
const HASH_FICTICIO = '$2a$10$gO34baDlnn8eucOf6ldRROQtmllGDSsZCjL.IuFFwABniMQiDVweS';

/** Autenticação: login com bcrypt, bloqueio por tentativas, logout e troca de senha. */
export class AuthService {
  public static readonly CONFIG_PADRAO: ConfiguracaoLogin = { maxTentativas: 5, minutosBloqueio: 15 };

  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hasher: SenhaHasher,
    private readonly sessao: SessionManager,
    private readonly config: ConfiguracaoLogin = AuthService.CONFIG_PADRAO,
  ) {}

  /**
   * Autentica e inicia a sessão. Qualquer falha (login inexistente, senha
   * errada, usuário inativo) gera a mesma mensagem genérica.
   */
  public async login(login: string, senha: string): Promise<UsuarioSessao> {
    // Nova tentativa encerra qualquer sessão anterior: um login que falha nunca deixa outro usuário logado.
    this.sessao.logout();
    const loginNormalizado = (login ?? '').trim().toLowerCase();
    if (!loginNormalizado || !senha || loginNormalizado.length > 50 || senha.length > 200) {
      throw new AuthenticationError();
    }

    const credenciais = await this.usuarios.findCredenciaisPorLogin(loginNormalizado);
    if (!credenciais) {
      await this.hasher.compare(senha, HASH_FICTICIO);
      throw new AuthenticationError();
    }

    const { usuario, senhaHash, segundosBloqueio } = credenciais;
    if (segundosBloqueio > 0) {
      const minutos = Math.ceil(segundosBloqueio / 60);
      throw new AuthenticationError(
        `Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em ${minutos} minuto(s).`,
      );
    }

    const senhaConfere = await this.hasher.compare(senha, senhaHash);
    if (!senhaConfere) {
      await this.usuarios.registrarFalhaLogin(usuario.id as number, this.config.maxTentativas, this.config.minutosBloqueio);
      throw new AuthenticationError();
    }
    if (!usuario.ativo) {
      throw new AuthenticationError();
    }

    await this.usuarios.registrarLoginSucesso(usuario.id as number);
    const sessao: UsuarioSessao = {
      id: usuario.id as number,
      nome: usuario.nome,
      login: usuario.login,
      perfil: usuario.perfil,
      especialidade: usuario.especialidade,
    };
    this.sessao.iniciar(sessao);
    return sessao;
  }

  public logout(): void {
    this.sessao.logout();
  }

  public usuarioAtual(): UsuarioSessao | null {
    return this.sessao.getUsuarioAtual();
  }

  /** Troca a própria senha; exige a senha atual. */
  public async trocarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = this.sessao.getUsuarioAtual();
    if (!usuario) throw new UnauthorizedError();

    const hashAtual = await this.usuarios.findSenhaHash(usuario.id);
    if (!hashAtual) throw new NotFoundError('Usuário', usuario.id);
    if (!(await this.hasher.compare(senhaAtual ?? '', hashAtual))) {
      throw new ValidationError('Senha atual incorreta.', { senhaAtual: 'Senha atual incorreta.' });
    }

    PoliticaSenha.validar(novaSenha, 'novaSenha');
    if (novaSenha === senhaAtual) {
      throw new ValidationError('A nova senha deve ser diferente da atual.', { novaSenha: 'Igual à senha atual.' });
    }
    await this.usuarios.atualizarSenha(usuario.id, await this.hasher.hash(novaSenha));
    this.sessao.tocar();
  }
}
