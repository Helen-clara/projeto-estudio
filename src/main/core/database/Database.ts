import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

/** Valores aceitos como parâmetro de prepared statement. */
export type SqlParam = string | number | boolean | Date | Buffer | null;

/** Configuração de conexão lida do .env. */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

/**
 * Contrato mínimo para executar SQL parametrizado.
 * Implementado pelo pool (Database) e pela conexão de uma transação,
 * para que repositories funcionem igual dentro e fora de transações.
 */
export interface SqlExecutor {
  /** SELECT: devolve as linhas tipadas. */
  query<T = RowDataPacket>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  /** INSERT/UPDATE/DELETE: devolve insertId/affectedRows. */
  execute(sql: string, params?: readonly SqlParam[]): Promise<ResultSetHeader>;
}

/** Erro de configuração do banco (variável ausente/inválida no .env). */
export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

/** Executor ligado a uma única conexão (usado dentro de transaction). */
class ConnectionExecutor implements SqlExecutor {
  constructor(private readonly connection: PoolConnection) {}

  public async query<T = RowDataPacket>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    const [rows] = await this.connection.execute<RowDataPacket[]>(sql, params as SqlParam[]);
    return rows as unknown as T[];
  }

  public async execute(sql: string, params: readonly SqlParam[] = []): Promise<ResultSetHeader> {
    const [result] = await this.connection.execute<ResultSetHeader>(sql, params as SqlParam[]);
    return result;
  }
}

/**
 * Acesso ao MySQL (Singleton).
 * Todas as consultas usam `execute` do mysql2, ou seja, prepared statements:
 * valores vão sempre em `params`, nunca concatenados no SQL.
 */
export class Database implements SqlExecutor {
  private static instance: Database | null = null;
  private static envLoaded = false;

  private readonly pool: Pool;

  private constructor(config: DatabaseConfig) {
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: config.connectionLimit,
      waitForConnections: true,
      charset: 'utf8mb4',
      // DECIMAL como number (valores monetários do projeto cabem em double).
      decimalNumbers: true,
      // Nunca permitir várias instruções numa chamada do app (mitiga injeção empilhada).
      multipleStatements: false,
    });
  }

  /** Instância única; o pool é criado na primeira chamada (conexões são abertas sob demanda). */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database(Database.configFromEnv());
    }
    return Database.instance;
  }

  /** Lê e valida a configuração do banco a partir do .env. */
  public static configFromEnv(): DatabaseConfig {
    if (!Database.envLoaded) {
      dotenv.config();
      Database.envLoaded = true;
    }

    const host = Database.requireEnv('DB_HOST');
    const user = Database.requireEnv('DB_USER');
    const database = Database.requireEnv('DB_NAME');
    const password = process.env.DB_PASSWORD ?? '';
    const port = Database.parsePositiveInt('DB_PORT', process.env.DB_PORT, 3306);
    const connectionLimit = Database.parsePositiveInt('DB_CONNECTION_LIMIT', process.env.DB_CONNECTION_LIMIT, 10);

    if (!/^[A-Za-z0-9_]+$/.test(database)) {
      throw new DatabaseConfigError('DB_NAME deve conter apenas letras, números e "_".');
    }

    return { host, port, user, password, database, connectionLimit };
  }

  public async query<T = RowDataPacket>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params as SqlParam[]);
    return rows as unknown as T[];
  }

  public async execute(sql: string, params: readonly SqlParam[] = []): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params as SqlParam[]);
    return result;
  }

  /** Conexão dedicada do pool. Quem chama deve liberar com `connection.release()`. */
  public async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  /**
   * Executa `callback` numa transação: commit se terminar bem, rollback se lançar erro.
   * Use o `tx` recebido (e não o Database) para que tudo rode na mesma conexão.
   */
  public async transaction<R>(callback: (tx: SqlExecutor) => Promise<R>): Promise<R> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(new ConnectionExecutor(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /** Fecha o pool e descarta a instância (ex.: ao encerrar o app ou em scripts). */
  public async close(): Promise<void> {
    await this.pool.end();
    if (Database.instance === this) {
      Database.instance = null;
    }
  }

  private static requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new DatabaseConfigError(`Variável ${name} não definida no .env.`);
    }
    return value;
  }

  private static parsePositiveInt(name: string, raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw.trim() === '') {
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new DatabaseConfigError(`Variável ${name} deve ser um inteiro positivo.`);
    }
    return value;
  }
}
