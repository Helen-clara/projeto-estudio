import { RowDataPacket } from 'mysql2/promise';
import type { CategoriaValor } from '../../../shared/dtos';
import type { StatusAgendamentoValor } from '../../../shared/agenda';
import { BaseRepository, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Agendamento, AgendamentoProps } from '../entities/Agendamento';
import { SqlFiltros } from './SqlFiltros';

/** Agendamento com os nomes relacionados (para listas e histórico). */
export interface AgendamentoDetalhado {
  agendamento: Agendamento;
  clienteNome: string;
  profissionalNome: string;
  servicoNome: string;
  servicoCategoria: CategoriaValor;
}

export interface BuscaAgendamentos {
  profissionalId?: number;
  clienteId?: number;
  /** Início do intervalo (inclusive). */
  de?: Date;
  /** Fim do intervalo (exclusivo). */
  ate?: Date;
  status?: StatusAgendamentoValor[];
  ativo?: boolean | 'todos';
  /** Ordem cronológica (padrão) ou mais recentes primeiro. */
  ordem?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

/** Status que ocupam a agenda do profissional (CANCELADO/FALTOU liberam o horário). */
const STATUS_QUE_OCUPAM = ['AGENDADO', 'CONFIRMADO', 'CONCLUIDO'] as const;

export class AgendamentoRepository extends BaseRepository<Agendamento, AgendamentoProps> {
  private static readonly SELECT_DETALHADO = `
    SELECT a.*, c.nome AS cliente_nome, u.nome AS profissional_nome,
           s.nome AS servico_nome, s.categoria AS servico_categoria
      FROM agendamentos a
      JOIN clientes c ON c.id = a.cliente_id
      JOIN usuarios u ON u.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id`;

  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'agendamentos',
        writableColumns: [
          'cliente_id', 'profissional_id', 'servico_id', 'data_hora_inicio', 'data_hora_fim',
          'status', 'valor_cobrado', 'observacoes',
        ],
        sortableColumns: ['data_hora_inicio', 'status'],
      },
      db,
    );
  }

  public async findDetalhadoById(id: number): Promise<AgendamentoDetalhado | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(
      `${AgendamentoRepository.SELECT_DETALHADO} WHERE a.id = ? LIMIT 1`,
      [id],
    );
    return rows.length > 0 ? this.mapDetalhado(rows[0]) : null;
  }

  /** Busca paginada com filtros combináveis (profissional, cliente, intervalo, status). */
  public async buscar(busca: BuscaAgendamentos = {}): Promise<Page<AgendamentoDetalhado>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const filtros = this.filtros(busca);
    const ordem = busca.ordem === 'DESC' ? 'DESC' : 'ASC';

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM agendamentos a${filtros.where}`,
      filtros.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `${AgendamentoRepository.SELECT_DETALHADO}${filtros.where}
        ORDER BY a.data_hora_inicio ${ordem}, a.id ${ordem} LIMIT ? OFFSET ?`,
      [...filtros.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapDetalhado(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  /** Soma de valor_cobrado de todos os registros do filtro (sem paginação). */
  public async somarValorCobrado(busca: BuscaAgendamentos = {}): Promise<number> {
    const filtros = this.filtros(busca);
    const [row] = await this.db.query<RowDataPacket>(
      `SELECT COALESCE(SUM(a.valor_cobrado), 0) AS total FROM agendamentos a${filtros.where}`,
      filtros.params,
    );
    return Number(row?.total ?? 0);
  }

  public listarPorProfissional(profissionalId: number, de: Date, ate: Date, limit = 500): Promise<Page<AgendamentoDetalhado>> {
    return this.buscar({ profissionalId, de, ate, limit });
  }

  public listarPorCliente(clienteId: number, limit = 50, offset = 0): Promise<Page<AgendamentoDetalhado>> {
    return this.buscar({ clienteId, ordem: 'DESC', limit, offset });
  }

  public listarPorPeriodo(de: Date, ate: Date, limit = 500, offset = 0): Promise<Page<AgendamentoDetalhado>> {
    return this.buscar({ de, ate, limit, offset });
  }

  /**
   * Há outro agendamento ativo do profissional que se sobrepõe a [inicio, fim)?
   * Dois intervalos se sobrepõem quando um começa antes do outro terminar:
   *   existente.inicio < novo.fim  E  existente.fim > novo.inicio
   * (encostar — terminar 10:00 e começar 10:00 — não é conflito).
   */
  public async existeConflito(profissionalId: number, inicio: Date, fim: Date, ignorarId?: number): Promise<boolean> {
    BaseRepository.assertId(profissionalId);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM agendamentos
        WHERE profissional_id = ?
          AND ativo = 1
          AND status IN (${STATUS_QUE_OCUPAM.map(() => '?').join(', ')})
          AND data_hora_inicio < ?
          AND data_hora_fim > ?
          AND id <> ?
        LIMIT 1`,
      [profissionalId, ...STATUS_QUE_OCUPAM, fim, inicio, ignorarId ?? 0],
    );
    return rows.length > 0;
  }

  /** O profissional tem vínculo ativo com o serviço (profissional_servicos)? */
  public async profissionalHabilitado(profissionalId: number, servicoId: number): Promise<boolean> {
    const rows = await this.db.query<RowDataPacket>(
      'SELECT 1 FROM profissional_servicos WHERE profissional_id = ? AND servico_id = ? AND ativo = 1 LIMIT 1',
      [profissionalId, servicoId],
    );
    return rows.length > 0;
  }

  private filtros(busca: BuscaAgendamentos): SqlFiltros {
    const f = new SqlFiltros().ativo('a.ativo', busca.ativo ?? true);
    if (busca.profissionalId) f.add('a.profissional_id = ?', busca.profissionalId);
    if (busca.clienteId) f.add('a.cliente_id = ?', busca.clienteId);
    if (busca.de) f.add('a.data_hora_inicio >= ?', busca.de);
    if (busca.ate) f.add('a.data_hora_inicio < ?', busca.ate);
    if (busca.status && busca.status.length > 0) {
      f.add(`a.status IN (${busca.status.map(() => '?').join(', ')})`, ...busca.status);
    }
    return f;
  }

  private mapDetalhado(row: RowDataPacket): AgendamentoDetalhado {
    return {
      agendamento: this.mapRow(row),
      clienteNome: row.cliente_nome,
      profissionalNome: row.profissional_nome,
      servicoNome: row.servico_nome,
      servicoCategoria: row.servico_categoria,
    };
  }

  protected mapRow(row: RowDataPacket): Agendamento {
    return Agendamento.restaurar(
      Number(row.id),
      {
        clienteId: Number(row.cliente_id),
        profissionalId: Number(row.profissional_id),
        servicoId: Number(row.servico_id),
        inicio: new Date(row.data_hora_inicio),
        fim: new Date(row.data_hora_fim),
        status: row.status,
        valorCobrado: row.valor_cobrado === null ? null : Number(row.valor_cobrado),
        observacoes: row.observacoes ?? null,
      },
      Number(row.ativo) === 1,
    );
  }

  protected toRow(data: Partial<AgendamentoProps>): RowValues {
    return {
      cliente_id: data.clienteId,
      profissional_id: data.profissionalId,
      servico_id: data.servicoId,
      data_hora_inicio: data.inicio,
      data_hora_fim: data.fim,
      status: data.status,
      valor_cobrado: data.valorCobrado,
      observacoes: data.observacoes,
    };
  }
}
