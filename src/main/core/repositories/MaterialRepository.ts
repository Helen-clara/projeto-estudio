import { RowDataPacket } from 'mysql2/promise';
import type { CategoriaValor } from '../../../shared/dtos';
import { CotacaoUsd } from '../../integrations/CotacaoClient';
import { BaseRepository, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Material, MaterialProps } from '../entities/Material';
import { SqlFiltros } from './SqlFiltros';

export interface BuscaMateriais {
  /** Parte do nome ou do fornecedor. */
  termo?: string;
  categoria?: CategoriaValor;
  /** Só materiais com quantidade_atual <= estoque_minimo. */
  apenasEstoqueBaixo?: boolean;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export interface ValorPorCategoria {
  categoria: CategoriaValor;
  itens: number;
  valorBrl: number;
  valorUsd: number;
  semPreco: number;
  estoqueBaixo: number;
}

export class MaterialRepository extends BaseRepository<Material, MaterialProps> {
  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'materiais',
        writableColumns: [
          'nome', 'categoria', 'unidade', 'quantidade_atual', 'estoque_minimo',
          'preco_custo_usd', 'preco_custo_brl', 'cotacao_usada', 'cotacao_em', 'fornecedor',
        ],
        sortableColumns: ['nome', 'categoria', 'quantidade_atual'],
      },
      db,
    );
  }

  public async buscar(busca: BuscaMateriais = {}): Promise<Page<Material>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const f = new SqlFiltros().ativo('ativo', busca.ativo ?? true);
    const termo = busca.termo?.trim();
    if (termo) {
      const like = SqlFiltros.like(termo);
      f.add('(nome LIKE ? OR fornecedor LIKE ?)', like, like);
    }
    if (busca.categoria) f.add('categoria = ?', busca.categoria);
    if (busca.apenasEstoqueBaixo) f.add('quantidade_atual <= estoque_minimo');

    const [total] = await this.db.query<RowDataPacket>(`SELECT COUNT(*) AS total FROM materiais${f.where}`, f.params);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT * FROM materiais${f.where} ORDER BY (quantidade_atual <= estoque_minimo) DESC, nome ASC LIMIT ? OFFSET ?`,
      [...f.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapRow(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  /** Materiais ativos com estoque baixo, do mais crítico (menor saldo/mínimo) para o menos. */
  public async listarEstoqueBaixo(): Promise<Material[]> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT * FROM materiais
        WHERE ativo = 1 AND quantidade_atual <= estoque_minimo
        ORDER BY (quantidade_atual - estoque_minimo) ASC, nome ASC`,
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async findByNome(nome: string): Promise<Material | null> {
    const rows = await this.db.query<RowDataPacket>('SELECT * FROM materiais WHERE nome = ? LIMIT 1', [nome]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /** Lê o material travando a linha até o fim da transação (use com o executor da transação). */
  public async findParaAtualizar(id: number): Promise<Material | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>('SELECT * FROM materiais WHERE id = ? FOR UPDATE', [id]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  public async atualizarQuantidade(id: number, quantidade: number): Promise<void> {
    await this.db.execute('UPDATE materiais SET quantidade_atual = ? WHERE id = ?', [quantidade, id]);
  }

  /** Materiais ativos com preço em USD (base do recálculo em BRL). */
  public async listarComPrecoUsd(): Promise<Material[]> {
    const rows = await this.db.query<RowDataPacket>(
      'SELECT * FROM materiais WHERE ativo = 1 AND preco_custo_usd IS NOT NULL ORDER BY nome',
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async contarSemPrecoUsd(): Promise<number> {
    const [row] = await this.db.query<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM materiais WHERE ativo = 1 AND preco_custo_usd IS NULL',
    );
    return Number(row?.total ?? 0);
  }

  /** Última cotação usada em algum material (fallback quando a API e o arquivo local falham). */
  public async ultimaCotacaoRegistrada(): Promise<CotacaoUsd | null> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT cotacao_usada, cotacao_em FROM materiais
        WHERE cotacao_usada IS NOT NULL AND cotacao_em IS NOT NULL
        ORDER BY cotacao_em DESC LIMIT 1`,
    );
    if (rows.length === 0) return null;
    return { valor: Number(rows[0].cotacao_usada), dataHora: new Date(rows[0].cotacao_em) };
  }

  /** Valor do estoque (quantidade × custo) por categoria, só materiais ativos. */
  public async valorPorCategoria(): Promise<ValorPorCategoria[]> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT categoria,
              COUNT(*) AS itens,
              COALESCE(SUM(quantidade_atual * preco_custo_brl), 0) AS valor_brl,
              COALESCE(SUM(quantidade_atual * preco_custo_usd), 0) AS valor_usd,
              SUM(preco_custo_brl IS NULL) AS sem_preco,
              SUM(quantidade_atual <= estoque_minimo) AS estoque_baixo
         FROM materiais
        WHERE ativo = 1
        GROUP BY categoria
        ORDER BY categoria`,
    );
    return rows.map((r) => ({
      categoria: r.categoria,
      itens: Number(r.itens),
      valorBrl: Math.round(Number(r.valor_brl) * 100) / 100,
      valorUsd: Math.round(Number(r.valor_usd) * 100) / 100,
      semPreco: Number(r.sem_preco),
      estoqueBaixo: Number(r.estoque_baixo),
    }));
  }

  protected mapRow(row: RowDataPacket): Material {
    const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
    return Material.restaurar(
      Number(row.id),
      {
        nome: row.nome,
        categoria: row.categoria,
        unidade: row.unidade,
        quantidadeAtual: Number(row.quantidade_atual),
        estoqueMinimo: Number(row.estoque_minimo),
        precoCustoUsd: num(row.preco_custo_usd),
        precoCustoBrl: num(row.preco_custo_brl),
        cotacaoUsada: num(row.cotacao_usada),
        cotacaoEm: row.cotacao_em ? new Date(row.cotacao_em) : null,
        fornecedor: row.fornecedor ?? null,
      },
      Number(row.ativo) === 1,
    );
  }

  protected toRow(d: Partial<MaterialProps>): RowValues {
    return {
      nome: d.nome,
      categoria: d.categoria,
      unidade: d.unidade,
      quantidade_atual: d.quantidadeAtual,
      estoque_minimo: d.estoqueMinimo,
      preco_custo_usd: d.precoCustoUsd,
      preco_custo_brl: d.precoCustoBrl,
      cotacao_usada: d.cotacaoUsada,
      cotacao_em: d.cotacaoEm,
      fornecedor: d.fornecedor,
    };
  }
}
