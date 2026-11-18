/**
 * Teste de conexão: mostra a versão do MySQL e quantas linhas cada tabela tem.
 *
 *   npm run db:check
 */
import { RowDataPacket } from 'mysql2/promise';
import { Database } from '../src/main/core/database/Database';
import { TABELAS, descreverErroMysql } from './tabelas';

class DbChecker {
  constructor(private readonly db: Database) {}

  public async run(): Promise<boolean> {
    const [info] = await this.db.query<RowDataPacket>('SELECT VERSION() AS versao, DATABASE() AS banco');
    console.log(`✔ Conectado. MySQL ${info?.versao} — banco "${info?.banco}"`);

    const existentes = new Set(
      (
        await this.db.query<RowDataPacket>(
          'SELECT table_name AS nome FROM information_schema.tables WHERE table_schema = DATABASE()',
        )
      ).map((r) => String(r.nome)),
    );

    let tudoOk = true;
    console.log('\nTabela                    Linhas');
    console.log('------------------------  ------');
    for (const tabela of TABELAS) {
      let linhas: string;
      if (existentes.has(tabela)) {
        // Nome vem da lista fixa TABELAS, não de entrada do usuário.
        const [row] = await this.db.query<RowDataPacket>(`SELECT COUNT(*) AS total FROM \`${tabela}\``);
        linhas = String(row?.total ?? 0);
      } else {
        linhas = 'AUSENTE';
        tudoOk = false;
      }
      console.log(`${tabela.padEnd(24)}  ${linhas}`);
    }

    if (!tudoOk) {
      console.log('\n⚠ Há tabelas ausentes: rode "npm run db:init".');
    }
    return tudoOk;
  }
}

async function main(): Promise<void> {
  let db: Database | null = null;
  try {
    db = Database.getInstance();
    const ok = await new DbChecker(db).run();
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error(`✖ Falha ao conectar: ${descreverErroMysql(error)}`);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}

void main();
