/** CEP brasileiro: exatamente 8 dígitos. */
export class CepValidator {
  public static normalize(cep: string): string {
    return cep.replace(/\D/g, '');
  }

  public static isValid(cep: string): boolean {
    const digits = CepValidator.normalize(cep);
    return /^\d{8}$/.test(digits) && digits !== '00000000';
  }

  public static format(cep: string): string {
    return CepValidator.normalize(cep).replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }
}
