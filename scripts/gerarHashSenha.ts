/**
 * Gera o hash bcrypt de uma senha (usado para montar o database/seed.sql).
 *
 * Uso:  npx ts-node scripts/gerarHashSenha.ts <senha> [custo]
 * Ex.:  npx ts-node scripts/gerarHashSenha.ts admin123
 *
 * Cada execução gera um salt novo, então o hash muda, mas qualquer hash
 * gerado continua validando a mesma senha com bcrypt.compare.
 */
import bcrypt from 'bcryptjs';

class GeradorHashSenha {
  private static readonly CUSTO_PADRAO = 10;

  public static executar(args: string[]): void {
    const [senha, custoTexto] = args;
    if (!senha) {
      console.error('Informe a senha: npx ts-node scripts/gerarHashSenha.ts <senha> [custo]');
      process.exitCode = 1;
      return;
    }

    const custo = custoTexto ? Number(custoTexto) : GeradorHashSenha.CUSTO_PADRAO;
    if (!Number.isInteger(custo) || custo < 4 || custo > 15) {
      console.error('Custo inválido: use um inteiro entre 4 e 15.');
      process.exitCode = 1;
      return;
    }

    console.log(bcrypt.hashSync(senha, custo));
  }
}

GeradorHashSenha.executar(process.argv.slice(2));
