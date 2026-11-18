import { ValidacaoCampos } from '../entities/DomainErrors';

/**
 * Regras para novas senhas. Senhas antigas (ex.: do seed) continuam
 * funcionando no login; a política vale ao criar, trocar ou resetar.
 */
export class PoliticaSenha {
  public static readonly TAMANHO_MINIMO = 8;
  /** bcrypt só considera os primeiros 72 bytes. */
  public static readonly TAMANHO_MAXIMO = 72;

  public static validar(senha: string | undefined, campo = 'senha'): void {
    new ValidacaoCampos()
      .check(
        typeof senha === 'string' &&
          senha.length >= PoliticaSenha.TAMANHO_MINIMO &&
          Buffer.byteLength(senha, 'utf8') <= PoliticaSenha.TAMANHO_MAXIMO &&
          /[A-Za-z]/.test(senha) &&
          /\d/.test(senha),
        campo,
        `Senha deve ter de ${PoliticaSenha.TAMANHO_MINIMO} a ${PoliticaSenha.TAMANHO_MAXIMO} caracteres, com letras e números.`,
      )
      .throwIfAny();
  }
}
