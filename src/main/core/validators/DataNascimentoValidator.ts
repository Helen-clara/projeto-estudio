/**
 * Data de nascimento no formato ISO (AAAA-MM-DD).
 * Tatuagem exige maioridade (18 anos): o cadastro é permitido, mas gera aviso.
 */
export class DataNascimentoValidator {
  public static readonly IDADE_MINIMA_TATUAGEM = 18;
  private static readonly IDADE_MAXIMA = 120;

  /** Converte AAAA-MM-DD em Date local; devolve null se a data não existir. */
  public static parse(valor: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
    if (!match) return null;
    const [ano, mes, dia] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const data = new Date(ano, mes - 1, dia);
    const existe = data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
    return existe ? data : null;
  }

  /** Data válida, não futura e com idade plausível. */
  public static isValid(valor: string, hoje: Date = new Date()): boolean {
    const data = DataNascimentoValidator.parse(valor);
    if (!data || data > hoje) return false;
    return DataNascimentoValidator.calcularIdade(data, hoje) <= DataNascimentoValidator.IDADE_MAXIMA;
  }

  public static calcularIdade(nascimento: Date, hoje: Date = new Date()): number {
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const aindaNaoFezAniversario =
      hoje.getMonth() < nascimento.getMonth() ||
      (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
    if (aindaNaoFezAniversario) idade--;
    return idade;
  }

  public static isMaiorDeIdade(nascimento: Date, hoje: Date = new Date()): boolean {
    return DataNascimentoValidator.calcularIdade(nascimento, hoje) >= DataNascimentoValidator.IDADE_MINIMA_TATUAGEM;
  }

  /** Date → AAAA-MM-DD usando a data local (sem deslocamento de fuso). */
  public static toIso(data: Date): string {
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mm}-${dd}`;
  }
}
