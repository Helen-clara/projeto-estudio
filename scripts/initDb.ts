/**
 * Cria as tabelas (database/schema.sql) e insere os dados de exemplo (database/seed.sql).
 *
 *   npm run db:init             cria o que faltar; o seed só roda se `usuarios` estiver vazia
 *   npm run db:init -- --reset  APAGA as 8 tabelas do projeto e recria tudo do zero
 *
 * O --reset remove somente as tabelas do projeto, nunca o banco inteiro
 * (seguro para servidores compartilhados em que o banco já existe).
 */
import fs from 'fs';
import path from 'path';
import mysql, { Connection, RowDataPacket } from 'mysql2/promise';
import { Database, DatabaseConfig } from '../src/main/core/database/Database';
import { TABELAS, descreverErroMysql } from './tabelas';

class DbInitializer {
  private static readonly DATABASE_DIR = path.resolve(__dirname, '..', 'database');

  constructor(
    private readonly config: DatabaseConfig,
    private readonly reset: boolean,
  ) {}

  public async run(): Promise<void> {
    console.log(`→ Conectando em ${this.config.host}:${this.config.port} como ${this.config.user}...`);
    const connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      charset: 'utf8mb4',
      connectTimeout: 10000,
      // Necessário para executar os arquivos .sql do projeto (conteúdo confiável, versionado).
      multipleStatements: true,
    });

    try {
      await this.selectDatabase(connection);
      if (this.reset) {
        await this.dropTables(connection);
      }
      await this.runFile(connection, 'schema.sql', 'Criando tabelas');
      await this.seedIfEmpty(connection);
      console.log('✔ Banco pronto. Rode "npm run db:check" para conferir.');
    } finally {
      await connection.end();
    }
  }

  private async selectDatabase(connection: Connection): Promise<void> {
    // DB_NAME já foi validado (só letras, números e "_"), então pode ser usado como identificador.
    const db = this.config.database;
    try {
      await connection.query(`USE \`${db}\``);
      console.log(`→ Usando o banco "${db}".`);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ER_BAD_DB_ERROR') throw error;
      console.log(`→ Banco "${db}" não existe; criando...`);
      await connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await connection.query(`USE \`${db}\``);
    }
  }

  private async dropTables(connection: Connection): Promise<void> {
    console.log('→ --reset: removendo as tabelas do projeto...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const tabela of [...TABELAS].reverse()) {
        await connection.query(`DROP TABLE IF EXISTS \`${tabela}\``);
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  private async seedIfEmpty(connection: Connection): Promise<void> {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM usuarios');
    if (Number(rows[0]?.total ?? 0) > 0) {
      console.log('→ Seed ignorado: já existem dados. Use "npm run db:init -- --reset" para recriar.');
      return;
    }
    await connection.beginTransaction();
    try {
      await this.runFile(connection, 'seed.sql', 'Inserindo dados de exemplo');
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  private async runFile(connection: Connection, file: string, label: string): Promise<void> {
    const fullPath = path.join(DbInitializer.DATABASE_DIR, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: database/${file}`);
    }
    console.log(`→ ${label} (database/${file})...`);
    await connection.query(fs.readFileSync(fullPath, 'utf8'));
  }
}

async function main(): Promise<void> {
  try {
    const reset = process.argv.includes('--reset');
    await new DbInitializer(Database.configFromEnv(), reset).run();
  } catch (error) {
    console.error(`✖ Falha ao inicializar o banco: ${descreverErroMysql(error)}`);
    process.exitCode = 1;
  }
}

void main();
