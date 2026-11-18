/**
 * Erros de domínio tipados. A mensagem é sempre segura para mostrar ao usuário
 * (em português, sem dados sensíveis); a camada IPC repassa só a mensagem.
 */
export abstract class DomainError extends Error {
  public abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Entrada inválida. `campos` mapeia campo → motivo, para a tela destacar. */
export class ValidationError extends DomainError {
  public readonly code = 'VALIDATION';

  constructor(
    message: string,
    public readonly campos: Readonly<Record<string, string>> = {},
  ) {
    super(message);
  }

  /** Cria a partir de uma lista de problemas por campo (mensagem = todos os motivos). */
  public static fromCampos(campos: Record<string, string>): ValidationError {
    return new ValidationError(Object.values(campos).join(' '), campos);
  }
}

/** Registro não encontrado. */
export class NotFoundError extends DomainError {
  public readonly code = 'NOT_FOUND';

  constructor(entidade: string, id?: number) {
    super(id === undefined ? `${entidade} não encontrado(a).` : `${entidade} #${id} não encontrado(a).`);
  }
}

/** Conflito com o estado atual (duplicidade, regra de negócio impedindo a ação). */
export class ConflictError extends DomainError {
  public readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Acumulador de erros de validação por campo, usado pelas entidades para
 * reportar todos os problemas de uma vez.
 */
export class ValidacaoCampos {
  private readonly erros: Record<string, string> = {};

  public add(campo: string, motivo: string): this {
    if (!(campo in this.erros)) this.erros[campo] = motivo;
    return this;
  }

  public check(condicao: boolean, campo: string, motivo: string): this {
    if (!condicao) this.add(campo, motivo);
    return this;
  }

  public throwIfAny(): void {
    if (Object.keys(this.erros).length > 0) {
      throw ValidationError.fromCampos(this.erros);
    }
  }
}

/** Normaliza texto opcional: trim e string vazia → null. */
export function textoOpcional(valor: string | null | undefined): string | null {
  const t = valor?.trim();
  return t ? t : null;
}
