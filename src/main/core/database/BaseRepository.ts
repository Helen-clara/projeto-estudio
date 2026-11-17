import { RowDataPacket } from 'mysql2/promise';
import { Database, SqlExecutor, SqlParam } from './Database';

/** Linha a gravar: coluna → valor. `undefined` = não alterar a coluna. */
export type RowValues = Record<string, SqlParam | undefined>;

/** Definição fixa da tabela, informada pela subclasse (nunca vem do usuário). */
export interface TableDefinition {
  /** Nome da tabela. */
  table: string;
  /** Colunas que podem ser gravadas em create/update (whitelist). */
  writableColumns: readonly string[];
  /** Colunas aceitas em ORDER BY. `id`, `created_at` e `updated_at` são sempre aceitas. */
  sortableColumns?: readonly string[];
}

export type SortDirection = 'ASC' | 'DESC';

export interface FindAllOptions {
  /** `true` (padrão) só ativos, `false` só inativos, `'todos'` sem filtro. */
  ativo?: boolean | 'todos';
  orderBy?: string;
  direction?: SortDirection;
  /** Tamanho da página (1–500, padrão 50). */
  limit?: number;
  /** Deslocamento (padrão 0). */
  offset?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Erro de uso do repository (coluna desconhecida, paginação inválida...). */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/**
 * CRUD genérico com exclusão lógica (`ativo`) sobre uma tabela com PK `id`.
 *
 * Segurança: nomes de tabela/colunas vêm somente da definição da subclasse e
 * são validados por regex e whitelist; valores sempre vão como parâmetros (?).
 *
 * @typeParam T      entidade/linha devolvida (montada por `mapRow`)
 * @typeParam TInput dados aceitos em create/update (convertidos por `toRow`)
 */
export abstract class BaseRepository<T, TInput = Partial<T>> {
  protected readonly table: string;
  private readonly writable: ReadonlySet<string>;
  private readonly sortable: ReadonlySet<string>;

  protected constructor(definition: TableDefinition, protected readonly db: SqlExecutor = Database.getInstance()) {
    BaseRepository.assertIdentifier(definition.table);
    definition.writableColumns.forEach((c) => BaseRepository.assertIdentifier(c));
    (definition.sortableColumns ?? []).forEach((c) => BaseRepository.assertIdentifier(c));

    this.table = definition.table;
    this.writable = new Set(definition.writableColumns);
    this.sortable = new Set(['id', 'created_at', 'updated_at', ...(definition.sortableColumns ?? [])]);
  }

  /** Converte uma linha do banco na entidade. */
  protected abstract mapRow(row: RowDataPacket): T;

  /** Converte os dados de entrada em colunas da tabela (somente colunas de `writableColumns`). */
  protected abstract toRow(data: Partial<TInput>): RowValues;

  public async findById(id: number): Promise<T | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(`SELECT * FROM \`${this.table}\` WHERE id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  public async findAll(options: FindAllOptions = {}): Promise<Page<T>> {
    const { where, params } = this.activeFilter(options.ativo ?? true);
    const { limit, offset } = BaseRepository.pagination(options.limit, options.offset);
    const orderBy = this.orderClause(options.orderBy, options.direction);

    const [countRow] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM \`${this.table}\`${where}`,
      params,
    );
    // LIMIT/OFFSET como string: o mysql2 com prepared statements no MySQL 8.0.22+
    // rejeita number nesses parâmetros. Os valores já foram validados como inteiros.
    const rows = await this.db.query<RowDataPacket>(
      `SELECT * FROM \`${this.table}\`${where}${orderBy} LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)],
    );

    return { items: rows.map((r) => this.mapRow(r)), total: Number(countRow?.total ?? 0), limit, offset };
  }

  public async create(data: TInput): Promise<T> {
    const entries = this.writableEntries(this.toRow(data));
    if (entries.length === 0) {
      throw new RepositoryError(`Nenhuma coluna válida para inserir em ${this.table}.`);
    }

    const columns = entries.map(([c]) => `\`${c}\``).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const result = await this.db.execute(
      `INSERT INTO \`${this.table}\` (${columns}) VALUES (${placeholders})`,
      entries.map(([, v]) => v),
    );

    const created = await this.findById(result.insertId);
    if (!created) {
      throw new RepositoryError(`Registro criado em ${this.table} não foi encontrado.`);
    }
    return created;
  }

  /** Atualiza só as colunas informadas. Devolve o registro atualizado ou `null` se não existir. */
  public async update(id: number, data: Partial<TInput>): Promise<T | null> {
    BaseRepository.assertId(id);
    const entries = this.writableEntries(this.toRow(data));
    if (entries.length > 0) {
      const sets = entries.map(([c]) => `\`${c}\` = ?`).join(', ');
      await this.db.execute(`UPDATE \`${this.table}\` SET ${sets} WHERE id = ?`, [...entries.map(([, v]) => v), id]);
    }
    return this.findById(id);
  }

  /** Exclusão lógica (`ativo = 0`). Devolve `false` se o id não existir. */
  public async softDelete(id: number): Promise<boolean> {
    return this.setAtivo(id, false);
  }

  /** Desfaz a exclusão lógica (`ativo = 1`). */
  public async restore(id: number): Promise<boolean> {
    return this.setAtivo(id, true);
  }

  public async exists(id: number): Promise<boolean> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(`SELECT 1 FROM \`${this.table}\` WHERE id = ? LIMIT 1`, [id]);
    return rows.length > 0;
  }

  private async setAtivo(id: number, ativo: boolean): Promise<boolean> {
    BaseRepository.assertId(id);
    const result = await this.db.execute(`UPDATE \`${this.table}\` SET ativo = ? WHERE id = ?`, [ativo ? 1 : 0, id]);
    return result.affectedRows > 0;
  }

  private writableEntries(row: RowValues): Array<[string, SqlParam]> {
    const entries: Array<[string, SqlParam]> = [];
    for (const [column, value] of Object.entries(row)) {
      if (value === undefined) continue;
      if (!this.writable.has(column)) {
        throw new RepositoryError(`Coluna "${column}" não pode ser gravada em ${this.table}.`);
      }
      entries.push([column, value]);
    }
    return entries;
  }

  private activeFilter(ativo: boolean | 'todos'): { where: string; params: SqlParam[] } {
    if (ativo === 'todos') return { where: '', params: [] };
    return { where: ' WHERE ativo = ?', params: [ativo ? 1 : 0] };
  }

  private orderClause(orderBy: string | undefined, direction: SortDirection | undefined): string {
    const column = orderBy ?? 'id';
    if (!this.sortable.has(column)) {
      throw new RepositoryError(`Ordenação por "${column}" não é permitida em ${this.table}.`);
    }
    const dir = direction === 'DESC' ? 'DESC' : 'ASC';
    return ` ORDER BY \`${column}\` ${dir}`;
  }

  /** Normaliza e valida paginação (útil também para consultas próprias das subclasses). */
  protected static pagination(limit?: number, offset?: number): { limit: number; offset: number } {
    const l = limit ?? DEFAULT_LIMIT;
    const o = offset ?? 0;
    if (!Number.isInteger(l) || l < 1 || l > MAX_LIMIT) {
      throw new RepositoryError(`limit deve ser inteiro entre 1 e ${MAX_LIMIT}.`);
    }
    if (!Number.isInteger(o) || o < 0) {
      throw new RepositoryError('offset deve ser inteiro maior ou igual a 0.');
    }
    return { limit: l, offset: o };
  }

  protected static assertId(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new RepositoryError('Id inválido.');
    }
  }

  private static assertIdentifier(name: string): void {
    if (!IDENTIFIER.test(name)) {
      throw new RepositoryError(`Identificador SQL inválido: "${name}".`);
    }
  }
}
