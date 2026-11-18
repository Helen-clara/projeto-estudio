import { SqlParam } from '../database/Database';

/**
 * Monta cláusulas WHERE com parâmetros (?) de forma incremental.
 * Só recebe fragmentos de SQL fixos escritos no código; valores vão sempre em params.
 */
export class SqlFiltros {
  private readonly condicoes: string[] = [];
  private readonly valores: SqlParam[] = [];

  public add(condicao: string, ...params: SqlParam[]): this {
    this.condicoes.push(condicao);
    this.valores.push(...params);
    return this;
  }

  /** Filtro de exclusão lógica: true = ativos, false = inativos, 'todos' = sem filtro. */
  public ativo(coluna: string, ativo: boolean | 'todos' = true): this {
    return ativo === 'todos' ? this : this.add(`${coluna} = ?`, ativo ? 1 : 0);
  }

  public get where(): string {
    return this.condicoes.length > 0 ? ` WHERE ${this.condicoes.join(' AND ')}` : '';
  }

  public get params(): SqlParam[] {
    return [...this.valores];
  }

  /** Escapa %, _ e \ para que o termo digitado seja buscado literalmente no LIKE. */
  public static like(termo: string, modo: 'contem' | 'comeca' = 'contem'): string {
    const escapado = termo.replace(/[\\%_]/g, (c) => `\\${c}`);
    return modo === 'contem' ? `%${escapado}%` : `${escapado}%`;
  }

  /** LIMIT/OFFSET como string (mysql2 + MySQL 8.0.22+ rejeitam number nesses placeholders). */
  public static paginacao(limit: number, offset: number): SqlParam[] {
    return [String(limit), String(offset)];
  }
}
