import { RowDataPacket } from 'mysql2/promise';
import type { CategoriaValor } from '../../../shared/dtos';
import { BaseRepository, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Servico, ServicoProps } from '../entities';
import { SqlFiltros } from './SqlFiltros';

export interface BuscaServicos {
  termo?: string;
  categoria?: CategoriaValor;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export class ServicoRepository extends BaseRepository<Servico, ServicoProps> {
  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'servicos',
        writableColumns: ['nome', 'descricao', 'categoria', 'duracao_minutos', 'preco'],
        sortableColumns: ['nome', 'categoria', 'preco', 'duracao_minutos'],
      },
      db,
    );
  }

  /** Converte uma linha de `servicos` (também usada em JOINs de outros repositories). */
  public static fromRow(row: RowDataPacket): Servico {
    return Servico.restaurar(
      Number(row.id),
      {
        nome: row.nome,
        descricao: row.descricao ?? null,
        categoria: row.categoria,
        duracaoMinutos: Number(row.duracao_minutos),
        preco: Number(row.preco),
      },
      Number(row.ativo) === 1,
    );
  }

  public async buscar(busca: BuscaServicos = {}): Promise<Page<Servico>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const filtros = new SqlFiltros().ativo('ativo', busca.ativo ?? true);
    const termo = busca.termo?.trim();
    if (termo) filtros.add('nome LIKE ?', SqlFiltros.like(termo));
    if (busca.categoria) filtros.add('categoria = ?', busca.categoria);

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM servicos${filtros.where}`,
      filtros.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `SELECT * FROM servicos${filtros.where} ORDER BY categoria ASC, nome ASC LIMIT ? OFFSET ?`,
      [...filtros.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapRow(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  /** Busca por nome exato (a collation do banco ignora maiúsculas/acentos). */
  public async findByNome(nome: string): Promise<Servico | null> {
    const rows = await this.db.query<RowDataPacket>('SELECT * FROM servicos WHERE nome = ? LIMIT 1', [nome]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /** Há agendamento futuro ainda em aberto (AGENDADO/CONFIRMADO) para este serviço? */
  public async temAgendamentoFuturo(servicoId: number): Promise<boolean> {
    BaseRepository.assertId(servicoId);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM agendamentos
        WHERE servico_id = ? AND ativo = 1 AND data_hora_inicio > NOW()
          AND status IN ('AGENDADO', 'CONFIRMADO')
        LIMIT 1`,
      [servicoId],
    );
    return rows.length > 0;
  }

  protected mapRow(row: RowDataPacket): Servico {
    return ServicoRepository.fromRow(row);
  }

  protected toRow(data: Partial<ServicoProps>): RowValues {
    return {
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      duracao_minutos: data.duracaoMinutos,
      preco: data.preco,
    };
  }
}
