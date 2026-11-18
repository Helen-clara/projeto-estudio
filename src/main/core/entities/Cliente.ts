import type { ClienteDTO, ClienteInput } from '../../../shared/dtos';
import { CpfValidator, DataNascimentoValidator, EmailValidator, TelefoneValidator } from '../validators';
import { ValidacaoCampos, textoOpcional } from './DomainErrors';
import { Endereco } from './Endereco';

/** Dados persistidos de um cliente (já normalizados). */
export interface ClienteProps {
  nome: string;
  cpf: string;
  dataNascimento: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  endereco: Endereco | null;
}

/** Cliente do estúdio (não faz login). */
export class Cliente {
  private _nome!: string;
  private _cpf!: string;
  private _dataNascimento!: string;
  private _telefone!: string | null;
  private _email!: string | null;
  private _observacoes!: string | null;
  private _endereco!: Endereco | null;

  private constructor(
    private readonly _id: number | null,
    props: ClienteProps,
    private _ativo: boolean,
  ) {
    this.aplicar(props);
  }

  /** Novo cliente a partir da entrada do usuário (valida e normaliza). */
  public static criar(input: ClienteInput): Cliente {
    return new Cliente(null, Cliente.normalizar(input), true);
  }

  /** Reconstrói a partir do banco (dados já gravados). */
  public static restaurar(id: number, props: ClienteProps, ativo: boolean): Cliente {
    return new Cliente(id, props, ativo);
  }

  /** Edita os dados (mesmas validações da criação). */
  public atualizar(input: ClienteInput): void {
    this.aplicar(Cliente.normalizar(input));
  }

  public get id(): number | null { return this._id; }
  public get nome(): string { return this._nome; }
  public get cpf(): string { return this._cpf; }
  public get dataNascimento(): string { return this._dataNascimento; }
  public get telefone(): string | null { return this._telefone; }
  public get email(): string | null { return this._email; }
  public get observacoes(): string | null { return this._observacoes; }
  public get endereco(): Endereco | null { return this._endereco; }
  public get ativo(): boolean { return this._ativo; }

  public idade(hoje: Date = new Date()): number {
    return DataNascimentoValidator.calcularIdade(this.nascimento(), hoje);
  }

  /** Menor de 18: pode ser cadastrado, mas não pode fazer tatuagem. */
  public isMenorDeIdade(hoje: Date = new Date()): boolean {
    return !DataNascimentoValidator.isMaiorDeIdade(this.nascimento(), hoje);
  }

  public toProps(): ClienteProps {
    return {
      nome: this._nome,
      cpf: this._cpf,
      dataNascimento: this._dataNascimento,
      telefone: this._telefone,
      email: this._email,
      observacoes: this._observacoes,
      endereco: this._endereco,
    };
  }

  public toDTO(): ClienteDTO {
    if (this._id === null) {
      throw new Error('Cliente ainda não foi salvo.');
    }
    return {
      id: this._id,
      nome: this._nome,
      cpf: this._cpf,
      dataNascimento: this._dataNascimento,
      idade: this.idade(),
      menorDeIdade: this.isMenorDeIdade(),
      telefone: this._telefone,
      email: this._email,
      observacoes: this._observacoes,
      endereco: this._endereco?.toDTO() ?? null,
      ativo: this._ativo,
    };
  }

  private nascimento(): Date {
    // Sempre válida: garantida em normalizar/restaurar.
    return DataNascimentoValidator.parse(this._dataNascimento) as Date;
  }

  private aplicar(props: ClienteProps): void {
    this._nome = props.nome;
    this._cpf = props.cpf;
    this._dataNascimento = props.dataNascimento;
    this._telefone = props.telefone;
    this._email = props.email;
    this._observacoes = props.observacoes;
    this._endereco = props.endereco;
  }

  private static normalizar(input: ClienteInput): ClienteProps {
    const nome = (input.nome ?? '').trim().replace(/\s+/g, ' ');
    const cpf = CpfValidator.normalize(input.cpf ?? '');
    const dataNascimento = (input.dataNascimento ?? '').trim();
    const telefoneBruto = textoOpcional(input.telefone);
    const emailBruto = textoOpcional(input.email);
    const observacoes = textoOpcional(input.observacoes);

    const v = new ValidacaoCampos()
      .check(nome.length >= 3 && nome.length <= 120, 'nome', 'Nome deve ter entre 3 e 120 caracteres.')
      .check(CpfValidator.isValid(cpf), 'cpf', 'CPF inválido.')
      .check(DataNascimentoValidator.isValid(dataNascimento), 'dataNascimento', 'Data de nascimento inválida (use AAAA-MM-DD, não pode ser futura).')
      .check(telefoneBruto === null || TelefoneValidator.isValid(telefoneBruto), 'telefone', 'Telefone inválido (informe DDD + número).')
      .check(emailBruto === null || EmailValidator.isValid(emailBruto), 'email', 'E-mail inválido.')
      .check((observacoes?.length ?? 0) <= 2000, 'observacoes', 'Observações muito longas (máx. 2000).');

    let endereco: Endereco | null = null;
    if (input.endereco && textoOpcional(input.endereco.cep)) {
      try {
        endereco = new Endereco(input.endereco);
      } catch (error) {
        const campos = (error as { campos?: Record<string, string> }).campos ?? {};
        Object.entries(campos).forEach(([campo, motivo]) => v.add(campo, motivo));
      }
    }
    v.throwIfAny();

    return {
      nome,
      cpf,
      dataNascimento,
      telefone: telefoneBruto ? TelefoneValidator.normalize(telefoneBruto) : null,
      email: emailBruto ? EmailValidator.normalize(emailBruto) : null,
      observacoes,
      endereco,
    };
  }
}
