import { RowDataPacket } from 'mysql2/promise';
import type { CategoriaValor } from '../../../shared/dtos';
import type { TipoMovimentacaoValor } from '../../../shared/estoque';
import { BaseRepository, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { MovimentacaoEstoque, MovimentacaoGravacao, PREFIXO_AJUSTE } from '../entities/MovimentacaoEstoque';
import { SqlFiltros } from './SqlFiltros';

export interface MovimentacaoDetalhada {
  movimentacao: MovimentacaoEstoque;
  materialNome: string;
  unidade: string;
  usuarioNome: string | null;
}

export interface BuscaMovimentacoes {
  materialId?: number;
  tipo?: TipoMovimentacaoValor;
  agendamentoId?: number;
  de?: Date;
  ate?: Date;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export interface ConsumoAgrupado {
  chave: string;
  rotulo: string;
  categoria: CategoriaValor;
  quantidade: number;
  valorBrl: number;
}

/** Dados do agendamento usados para validar uma saída ligada a atendimento. */
export interface AgendamentoDaSaida {
  id: number;
  profissionalId: number;
  status: string;
  ativo: boolean;
}

/** Filtro SQL que separa ajustes de inventário (gravados com prefixo no motivo). */
const LIKE_AJUSTE = `${PREFIXO_AJUSTE}%`;

export class MovimentacaoRepository extends BaseRepository<MovimentacaoEstoque, MovimentacaoGravacao> {
  private static readonly SELECT_DETALHADO = `
    SELECT mv.*, m.nome AS material_nome, m.unidade, u.nome AS usuario_nome
      FROM movimentacoes_estoque mv
      JOIN materiais m ON m.id = mv.material_id
      LEFT JOIN usuarios u ON u.id = mv.usuario_id`;

  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'movimentacoes_estoque',
        writableColumns: ['material_id', 'agendamento_id', 'usuario_id', 'tipo', 'quantidade', 'motivo'],
        sortableColumns: ['created_at', 'tipo'],
      },
      db,
    );
  }

  public async buscar(busca: BuscaMovimentacoes = {}): Promise<Page<MovimentacaoDetalhada>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const f = new SqlFiltros().ativo('mv.ativo', busca.ativo ?? true);
    if (busca.materialId) f.add('mv.material_id = ?', busca.materialId);
    if (busca.agendamentoId) f.add('mv.agendamento_id = ?', busca.agendamentoId);
    if (busca.tipo === 'AJUSTE') f.add('mv.motivo LIKE ?', LIKE_AJUSTE);
    else if (busca.tipo) f.add("mv.tipo = ? AND (mv.motivo IS NULL OR mv.motivo NOT LIKE ?)", busca.tipo, LIKE_AJUSTE);
    if (busca.de) f.add('mv.created_at >= ?', busca.de);
    if (busca.ate) f.add('mv.created_at < ?', busca.ate);

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM movimentacoes_estoque mv${f.where}`,
      f.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `${MovimentacaoRepository.SELECT_DETALHADO}${f.where} ORDER BY mv.created_at DESC, mv.id DESC LIMIT ? OFFSET ?`,
      [...f.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapDetalhado(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  public async findDetalhadoById(id: number): Promise<MovimentacaoDetalhada | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(`${MovimentacaoRepository.SELECT_DETALHADO} WHERE mv.id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? this.mapDetalhado(rows[0]) : null;
  }

  /** Movimentação travada para estorno (use com o executor da transação). */
  public async findParaAtualizar(id: number): Promise<MovimentacaoEstoque | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>('SELECT * FROM movimentacoes_estoque WHERE id = ? FOR UPDATE', [id]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /**
   * Consumo (saídas, sem ajustes nem estornos) no período, agrupado por categoria ou material.
   * Valor estimado pelo custo atual em BRL do material.
   */
  public async consumo(de: Date, ate: Date, agrupar: 'categoria' | 'material'): Promise<ConsumoAgrupado[]> {
    const grupo = agrupar === 'categoria' ? 'm.categoria' : 'm.id, m.nome, m.categoria';
    const chave = agrupar === 'categoria' ? 'm.categoria' : 'm.id';
    const rotulo = agrupar === 'categoria' ? 'm.categoria' : 'm.nome';
    const rows = await this.db.query<RowDataPacket>(
      `SELECT ${chave} AS chave, ${rotulo} AS rotulo, m.categoria AS categoria,
              SUM(mv.quantidade) AS quantidade,
              COALESCE(SUM(mv.quantidade * m.preco_custo_brl), 0) AS valor_brl
         FROM movimentacoes_estoque mv
         JOIN materiais m ON m.id = mv.material_id
        WHERE mv.ativo = 1 AND mv.tipo = 'SAIDA'
          AND (mv.motivo IS NULL OR mv.motivo NOT LIKE ?)
          AND mv.created_at >= ? AND mv.created_at < ?
        GROUP BY ${grupo}
        ORDER BY valor_brl DESC, quantidade DESC`,
      [LIKE_AJUSTE, de, ate],
    );
    return rows.map((r) => ({
      chave: String(r.chave),
      rotulo: String(r.rotulo),
      categoria: r.categoria,
      quantidade: Math.round(Number(r.quantidade) * 100) / 100,
      valorBrl: Math.round(Number(r.valor_brl) * 100) / 100,
    }));
  }

  public async agendamentoDaSaida(agendamentoId: number): Promise<AgendamentoDaSaida | null> {
    BaseRepository.assertId(agendamentoId);
    const rows = await this.db.query<RowDataPacket>(
      'SELECT id, profissional_id, status, ativo FROM agendamentos WHERE id = ? LIMIT 1',
      [agendamentoId],
    );
    if (rows.length === 0) return null;
    return {
      id: Number(rows[0].id),
      profissionalId: Number(rows[0].profissional_id),
      status: String(rows[0].status),
      ativo: Number(rows[0].ativo) === 1,
    };
  }

  private mapDetalhado(row: RowDataPacket): MovimentacaoDetalhada {
    return {
      movimentacao: this.mapRow(row),
      materialNome: row.material_nome,
      unidade: row.unidade,
      usuarioNome: row.usuario_nome ?? null,
    };
  }

  protected mapRow(row: RowDataPacket): MovimentacaoEstoque {
    return MovimentacaoEstoque.restaurar(
      Number(row.id),
      {
        materialId: Number(row.material_id),
        tipoBanco: row.tipo,
        quantidade: Number(row.quantidade),
        motivo: row.motivo ?? null,
        agendamentoId: row.agendamento_id === null ? null : Number(row.agendamento_id),
        usuarioId: row.usuario_id === null ? null : Number(row.usuario_id),
        data: new Date(row.created_at),
      },
      Number(row.ativo) === 1,
    );
  }

  protected toRow(d: Partial<MovimentacaoGravacao>): RowValues {
    return {
      material_id: d.materialId,
      agendamento_id: d.agendamentoId,
      usuario_id: d.usuarioId,
      tipo: d.tipoBanco,
      quantidade: d.quantidade,
      motivo: d.motivo,
    };
  }
}
