import type { EspecialidadeValor, PerfilValor, UsuarioInput } from '../../../shared/dtos';
import { CpfValidator, EmailValidator, TelefoneValidator } from '../validators';
import { ValidacaoCampos, textoOpcional } from './DomainErrors';
import { Profissional } from './Profissional';

const PERFIS: readonly PerfilValor[] = ['ADMIN', 'RECEPCAO', 'PROFISSIONAL'];

export interface UsuarioProps {
  nome: string;
  cpf: string | null;
  email: string;
  telefone: string | null;
  login: string;
  perfil: PerfilValor;
  especialidade: EspecialidadeValor | null;
}

/** Dados de controle de acesso lidos do banco (não editáveis pelo cadastro). */
export interface UsuarioAcesso {
  ultimoAcesso: Date | null;
  bloqueado: boolean;
}

/** Qualquer pessoa que faz login: ADMIN, RECEPCAO ou PROFISSIONAL. Nunca guarda senha/hash. */
export class Usuario {
  private _props!: UsuarioProps;

  private constructor(
    private readonly _id: number | null,
    props: UsuarioProps,
    private readonly _ativo: boolean,
    private readonly _acesso: UsuarioAcesso = { ultimoAcesso: null, bloqueado: false },
  ) {
    this._props = props;
  }

  public static criar(input: UsuarioInput): Usuario {
    return new Usuario(null, Usuario.normalizar(input), true);
  }

  public static restaurar(id: number, props: UsuarioProps, ativo: boolean, acesso?: UsuarioAcesso): Usuario {
    return new Usuario(id, props, ativo, acesso);
  }

  public atualizar(input: UsuarioInput): void {
    this._props = Usuario.normalizar(input);
  }

  public static isPerfil(valor: unknown): valor is PerfilValor {
    return typeof valor === 'string' && (PERFIS as readonly string[]).includes(valor);
  }

  public get id(): number | null { return this._id; }
  public get nome(): string { return this._props.nome; }
  public get cpf(): string | null { return this._props.cpf; }
  public get email(): string { return this._props.email; }
  public get telefone(): string | null { return this._props.telefone; }
  public get login(): string { return this._props.login; }
  public get perfil(): PerfilValor { return this._props.perfil; }
  public get especialidade(): EspecialidadeValor | null { return this._props.especialidade; }
  public get ativo(): boolean { return this._ativo; }
  public get ultimoAcesso(): Date | null { return this._acesso.ultimoAcesso; }
  public get bloqueado(): boolean { return this._acesso.bloqueado; }

  public toProps(): UsuarioProps {
    return { ...this._props };
  }

  private static normalizar(input: UsuarioInput): UsuarioProps {
    const nome = (input.nome ?? '').trim().replace(/\s+/g, ' ');
    const cpfBruto = textoOpcional(input.cpf);
    const cpf = cpfBruto ? CpfValidator.normalize(cpfBruto) : null;
    const email = EmailValidator.normalize(input.email ?? '');
    const telefoneBruto = textoOpcional(input.telefone);
    const login = (input.login ?? '').trim().toLowerCase();
    const perfil = input.perfil;
    const especialidade = input.especialidade ?? null;

    new ValidacaoCampos()
      .check(nome.length >= 3 && nome.length <= 120, 'nome', 'Nome deve ter entre 3 e 120 caracteres.')
      .check(cpf === null || CpfValidator.isValid(cpf), 'cpf', 'CPF inválido.')
      .check(EmailValidator.isValid(email), 'email', 'E-mail inválido.')
      .check(telefoneBruto === null || TelefoneValidator.isValid(telefoneBruto), 'telefone', 'Telefone inválido (informe DDD + número).')
      .check(/^[a-z0-9._-]{3,50}$/.test(login), 'login', 'Login deve ter de 3 a 50 caracteres (letras, números, ".", "_" ou "-").')
      .check(Usuario.isPerfil(perfil), 'perfil', 'Perfil deve ser ADMIN, RECEPCAO ou PROFISSIONAL.')
      .check(
        perfil === 'PROFISSIONAL' ? Profissional.isEspecialidade(especialidade) : especialidade === null,
        'especialidade',
        perfil === 'PROFISSIONAL'
          ? 'Profissional precisa de especialidade (TATUADOR ou ESTETICISTA).'
          : 'Somente profissionais têm especialidade.',
      )
      .throwIfAny();

    return {
      nome,
      cpf,
      email,
      telefone: telefoneBruto ? TelefoneValidator.normalize(telefoneBruto) : null,
      login,
      perfil,
      especialidade,
    };
  }
}
