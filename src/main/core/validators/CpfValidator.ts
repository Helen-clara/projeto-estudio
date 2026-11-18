/** Validação de CPF pelos dígitos verificadores. */
export class CpfValidator {
  /** Remove tudo que não for dígito. */
  public static normalize(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  public static isValid(cpf: string): boolean {
    const digits = CpfValidator.normalize(cpf);
    if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
      return false;
    }
    const nums = digits.split('').map(Number);
    return CpfValidator.digito(nums, 9) === nums[9] && CpfValidator.digito(nums, 10) === nums[10];
  }

  /** Formata 11 dígitos como 000.000.000-00. */
  public static format(cpf: string): string {
    return CpfValidator.normalize(cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  private static digito(nums: number[], tamanho: number): number {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += nums[i] * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }
}
