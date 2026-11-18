/** Telefone brasileiro: DDD (11–99) + 8 dígitos (fixo) ou 9 dígitos começando com 9 (celular). */
export class TelefoneValidator {
  /** Remove não dígitos e o prefixo do país (55), se houver. */
  public static normalize(telefone: string): string {
    const digits = telefone.replace(/\D/g, '');
    return digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  }

  public static isValid(telefone: string): boolean {
    const digits = TelefoneValidator.normalize(telefone);
    if (!/^[1-9][1-9]\d{8,9}$/.test(digits)) {
      return false;
    }
    // Celular (11 dígitos) começa com 9 após o DDD.
    return digits.length === 10 || digits[2] === '9';
  }

  public static format(telefone: string): string {
    const d = TelefoneValidator.normalize(telefone);
    return d.length === 11
      ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
      : d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
}
