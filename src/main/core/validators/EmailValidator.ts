/** Validação simples e pragmática de e-mail. */
export class EmailValidator {
  private static readonly PADRAO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  private static readonly TAMANHO_MAXIMO = 150;

  public static normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  public static isValid(email: string): boolean {
    const valor = EmailValidator.normalize(email);
    return valor.length <= EmailValidator.TAMANHO_MAXIMO && EmailValidator.PADRAO.test(valor);
  }
}
