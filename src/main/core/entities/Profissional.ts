import type { CategoriaValor, EspecialidadeValor, ProfissionalDTO, ProfissionalInput } from '../../../shared/dtos';
import { CpfValidator, EmailValidator, TelefoneValidator } from '../validators';
import { ValidacaoCampos, textoOpcional } from './DomainErrors';

const ESPECIALIDADES: readonly EspecialidadeValor[] = ['TATUADOR', 'ESTETICISTA'];

/** Categoria de serviço que cada especialidade pode realizar. */
const CATEGORIA_POR_ESPECIALIDADE: Readonly<Record<EspecialidadeValor, CategoriaValor>> = {
  TATUADOR: 'TATUAGEM',
  ESTETICISTA: 'ESTETICA',
};

export const SENHA_TAMANHO_MINIMO = 8;

export interface ProfissionalProps {
  nome: string;
  cpf: string | null;
  email: string;
  telefone: string | null;
  login: string;
  especialidade: EspecialidadeValor;
}

/**
 * Profissional do estúdio: um registro da tabela `usuarios` com perfil PROFISSIONAL.
 * A senha nunca fica na entidade; o hash é tratado só no service/repository.
 */
export class Profissional {
  private _nome!: string;
  private _cpf!: string | null;
  private _email!: string;
  private _telefone!: string | null;
  private _login!: string;
  private _especialidade!: EspecialidadeValor;

  private constructor(
    private readonly _id: number | null,
    props: ProfissionalProps,
    private readonly _ativo: boolean,
  ) {
    this.aplicar(props);
  }

  public static criar(input: ProfissionalInput): Profissional {
    return new Profissional(null, Profissional.normalizar(input), true);
  }

  public static restaurar(id: number, props: ProfissionalProps, ativo: boolean): Profissional {
    return new Profissional(id, props, ativo);
  }

  public atualizar(input: ProfissionalInput): void {
    this.aplicar(Profissional.normalizar(input));
  }

  public static isEspecialidade(valor: unknown): valor is EspecialidadeValor {
    return typeof valor === 'string' && (ESPECIALIDADES as readonly string[]).includes(valor);
  }

  /** Regra de senha para novos profissionais. */
  public static validarSenha(senha: string | undefined): void {
    new ValidacaoCampos()
      .check(
        typeof senha === 'string' && senha.length >= SENHA_TAMANHO_MINIMO && senha.length <= 72 &&
          /[A-Za-z]/.test(senha) && /\d/.test(senha),
        'senha',
        `Senha deve ter de ${SENHA_TAMANHO_MINIMO} a 72 caracteres, com letras e números.`,
      )
      .throwIfAny();
  }

  public get id(): number | null { return this._id; }
  public get nome(): string { return this._nome; }
  public get cpf(): string | null { return this._cpf; }
  public get email(): string { return this._email; }
  public get telefone(): string | null { return this._telefone; }
  public get login(): string { return this._login; }
  public get especialidade(): EspecialidadeValor { return this._especialidade; }
  public get ativo(): boolean { return this._ativo; }

  /** Categoria de serviço compatível com a especialidade (TATUADOR→TATUAGEM, ESTETICISTA→ESTETICA). */
  public get categoriaAtendida(): CategoriaValor {
    return CATEGORIA_POR_ESPECIALIDADE[this._especialidade];
  }

  public podeRealizar(categoria: CategoriaValor): boolean {
    return this.categoriaAtendida === categoria;
  }

  public toProps(): ProfissionalProps {
    return {
      nome: this._nome,
      cpf: this._cpf,
      email: this._email,
      telefone: this._telefone,
      login: this._login,
      especialidade: this._especialidade,
    };
  }

  public toDTO(): ProfissionalDTO {
    if (this._id === null) {
      throw new Error('Profissional ainda não foi salvo.');
    }
    return { id: this._id, ...this.toProps(), ativo: this._ativo };
  }

  private aplicar(props: ProfissionalProps): void {
    this._nome = props.nome;
    this._cpf = props.cpf;
    this._email = props.email;
    this._telefone = props.telefone;
    this._login = props.login;
    this._especialidade = props.especialidade;
  }

  private static normalizar(input: ProfissionalInput): ProfissionalProps {
    const nome = (input.nome ?? '').trim().replace(/\s+/g, ' ');
    const cpfBruto = textoOpcional(input.cpf);
    const cpf = cpfBruto ? CpfValidator.normalize(cpfBruto) : null;
    const email = EmailValidator.normalize(input.email ?? '');
    const telefoneBruto = textoOpcional(input.telefone);
    const login = (input.login ?? '').trim().toLowerCase();

    new ValidacaoCampos()
      .check(nome.length >= 3 && nome.length <= 120, 'nome', 'Nome deve ter entre 3 e 120 caracteres.')
      .check(cpf === null || CpfValidator.isValid(cpf), 'cpf', 'CPF inválido.')
      .check(EmailValidator.isValid(email), 'email', 'E-mail inválido.')
      .check(telefoneBruto === null || TelefoneValidator.isValid(telefoneBruto), 'telefone', 'Telefone inválido (informe DDD + número).')
      .check(/^[a-z0-9._-]{3,50}$/.test(login), 'login', 'Login deve ter de 3 a 50 caracteres (letras, números, ".", "_" ou "-").')
      .check(Profissional.isEspecialidade(input.especialidade), 'especialidade', 'Especialidade deve ser TATUADOR ou ESTETICISTA.')
      .throwIfAny();

    return {
      nome,
      cpf,
      email,
      telefone: telefoneBruto ? TelefoneValidator.normalize(telefoneBruto) : null,
      login,
      especialidade: input.especialidade,
    };
  }
}
