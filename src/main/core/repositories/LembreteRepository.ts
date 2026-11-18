import { RowDataPacket } from 'mysql2/promise';
import type { CategoriaValor } from '../../../shared/dtos';
import type { CanalLembreteValor, StatusLembreteValor } from '../../../shared/lembretes';
import { BaseRepository, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Lembrete, LembreteProps } from '../entities/Lembrete';
import { SqlFiltros } from './SqlFiltros';

/** Lembrete com dados do agendamento (para listas). */
export interface LembreteDetalhado {
  lembrete: Lembrete;
  clienteNome: string;
  profissionalNome: string;
  servicoNome: string;
  inicioAgendamento: Date;
}

/** Agendamento que precisa de lembrete, com tudo o que a mensagem usa. */
export interface AgendamentoParaLembrete {
  agendamentoId: number;
  inicio: Date;
  fim: Date;
  clienteNome: string;
  clienteEmail: string | null;
  profissionalNome: string;
  servicoNome: string;
  servicoCategoria: CategoriaValor;
  /** Lembrete já existente (PENDENTE/FALHA) ou null. */
  lembrete: Lembrete | null;
}

export interface BuscaLembretes {
  status?: StatusLembreteValor;
  agendamentoId?: number;
  /** Data do agendamento: início (inclusive) e fim (exclusivo). */
  de?: Date;
  ate?: Date;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export class LembreteRepository extends BaseRepository<Lembrete, LembreteProps> {
  private static readonly SELECT_DETALHADO = `
    SELECT l.*, a.data_hora_inicio AS agendamento_inicio, c.nome AS cliente_nome,
           u.nome AS profissional_nome, s.nome AS servico_nome
      FROM lembretes l
      JOIN agendamentos a ON a.id = l.agendamento_id
      JOIN clientes c ON c.id = a.cliente_id
      JOIN usuarios u ON u.id = a.profissional_id
      JOIN servicos s ON s.id = a.servico_id`;

  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'lembretes',
        writableColumns: ['agendamento_id', 'canal', 'destinatario', 'status', 'tentativas', 'agendado_para', 'enviado_em', 'erro'],
        sortableColumns: ['agendado_para', 'status'],
      },
      db,
    );
  }

  /**
   * Cria o lembrete PENDENTE do agendamento/canal ou devolve o que já existe.
   * A UNIQUE (agendamento_id, canal) impede duplicidade mesmo com duas execuções ao mesmo tempo.
   */
  public async criarPendente(lembrete: Lembrete): Promise<Lembrete> {
    const p = lembrete.toProps();
    await this.db.execute(
      `INSERT INTO lembretes (agendamento_id, canal, destinatario, status, tentativas, agendado_para)
       VALUES (?, ?, ?, 'PENDENTE', 0, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [p.agendamentoId, p.canal, p.destinatario, p.agendadoPara],
    );
    const salvo = await this.findByAgendamento(p.agendamentoId, p.canal);
    if (!salvo) throw new Error('Falha ao criar lembrete.');
    return salvo;
  }

  public async findByAgendamento(agendamentoId: number, canal: CanalLembreteValor = 'EMAIL'): Promise<Lembrete | null> {
    BaseRepository.assertId(agendamentoId);
    const rows = await this.db.query<RowDataPacket>(
      'SELECT * FROM lembretes WHERE agendamento_id = ? AND canal = ? LIMIT 1',
      [agendamentoId, canal],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /** Lista paginada com dados do agendamento, mais recentes primeiro. */
  public async buscar(busca: BuscaLembretes = {}): Promise<Page<LembreteDetalhado>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const f = new SqlFiltros().ativo('l.ativo', busca.ativo ?? true);
    if (busca.status) f.add('l.status = ?', busca.status);
    if (busca.agendamentoId) f.add('l.agendamento_id = ?', busca.agendamentoId);
    if (busca.de) f.add('a.data_hora_inicio >= ?', busca.de);
    if (busca.ate) f.add('a.data_hora_inicio < ?', busca.ate);

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM lembretes l JOIN agendamentos a ON a.id = l.agendamento_id${f.where}`,
      f.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `${LembreteRepository.SELECT_DETALHADO}${f.where}
        ORDER BY a.data_hora_inicio DESC, l.id DESC LIMIT ? OFFSET ?`,
      [...f.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapDetalhado(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  public async findDetalhadoById(id: number): Promise<LembreteDetalhado | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(`${LembreteRepository.SELECT_DETALHADO} WHERE l.id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? this.mapDetalhado(rows[0]) : null;
  }

  /** Lembretes ainda não enviados (PENDENTE ou FALHA com tentativas sobrando). */
  public async listarPendentes(maxTentativas: number, limit = 200): Promise<Page<LembreteDetalhado>> {
    const rows = await this.db.query<RowDataPacket>(
      `${LembreteRepository.SELECT_DETALHADO}
        WHERE l.ativo = 1 AND l.status IN ('PENDENTE', 'FALHA') AND l.tentativas < ?
        ORDER BY l.agendado_para ASC LIMIT ?`,
      [maxTentativas, String(limit)],
    );
    return { items: rows.map((r) => this.mapDetalhado(r)), total: rows.length, limit, offset: 0 };
  }

  /**
   * Agendamentos AGENDADO/CONFIRMADO com início em [de, ate) que ainda precisam de
   * lembrete: sem lembrete, ou com lembrete PENDENTE/FALHA ativo e tentativas sobrando.
   */
  public async agendamentosParaLembrete(de: Date, ate: Date, maxTentativas: number): Promise<AgendamentoParaLembrete[]> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT a.id AS agendamento_id, a.data_hora_inicio, a.data_hora_fim,
              c.nome AS cliente_nome, c.email AS cliente_email,
              u.nome AS profissional_nome, s.nome AS servico_nome, s.categoria AS servico_categoria,
              l.id AS l_id, l.canal AS l_canal, l.destinatario AS l_destinatario, l.status AS l_status,
              l.tentativas AS l_tentativas, l.agendado_para AS l_agendado_para, l.enviado_em AS l_enviado_em,
              l.erro AS l_erro, l.ativo AS l_ativo
         FROM agendamentos a
         JOIN clientes c ON c.id = a.cliente_id
         JOIN usuarios u ON u.id = a.profissional_id
         JOIN servicos s ON s.id = a.servico_id
         LEFT JOIN lembretes l ON l.agendamento_id = a.id AND l.canal = 'EMAIL'
        WHERE a.ativo = 1
          AND a.status IN ('AGENDADO', 'CONFIRMADO')
          AND a.data_hora_inicio >= ? AND a.data_hora_inicio < ?
          AND (l.id IS NULL OR (l.ativo = 1 AND l.status IN ('PENDENTE', 'FALHA') AND l.tentativas < ?))
        ORDER BY a.data_hora_inicio ASC`,
      [de, ate, maxTentativas],
    );
    return rows.map((r) => ({
      agendamentoId: Number(r.agendamento_id),
      inicio: new Date(r.data_hora_inicio),
      fim: new Date(r.data_hora_fim),
      clienteNome: r.cliente_nome,
      clienteEmail: r.cliente_email ?? null,
      profissionalNome: r.profissional_nome,
      servicoNome: r.servico_nome,
      servicoCategoria: r.servico_categoria,
      lembrete: r.l_id
        ? Lembrete.restaurar(
            Number(r.l_id),
            {
              agendamentoId: Number(r.agendamento_id),
              canal: r.l_canal,
              destinatario: r.l_destinatario ?? null,
              status: r.l_status,
              tentativas: Number(r.l_tentativas),
              agendadoPara: new Date(r.l_agendado_para),
              enviadoEm: r.l_enviado_em ? new Date(r.l_enviado_em) : null,
              erro: r.l_erro ?? null,
            },
            Number(r.l_ativo) === 1,
          )
        : null,
    }));
  }

  /** Dados de um agendamento para (re)montar a mensagem. */
  public async agendamentoParaLembrete(agendamentoId: number): Promise<AgendamentoParaLembrete | null> {
    BaseRepository.assertId(agendamentoId);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT a.id, a.data_hora_inicio, a.data_hora_fim, a.status, a.ativo,
              c.nome AS cliente_nome, c.email AS cliente_email,
              u.nome AS profissional_nome, s.nome AS servico_nome, s.categoria AS servico_categoria
         FROM agendamentos a
         JOIN clientes c ON c.id = a.cliente_id
         JOIN usuarios u ON u.id = a.profissional_id
         JOIN servicos s ON s.id = a.servico_id
        WHERE a.id = ? LIMIT 1`,
      [agendamentoId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      agendamentoId: Number(r.id),
      inicio: new Date(r.data_hora_inicio),
      fim: new Date(r.data_hora_fim),
      clienteNome: r.cliente_nome,
      clienteEmail: r.cliente_email ?? null,
      profissionalNome: r.profissional_nome,
      servicoNome: r.servico_nome,
      servicoCategoria: r.servico_categoria,
      lembrete: await this.findByAgendamento(agendamentoId),
    };
  }

  /** O agendamento ainda está em aberto e no futuro? */
  public async agendamentoEmAberto(agendamentoId: number): Promise<boolean> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM agendamentos
        WHERE id = ? AND ativo = 1 AND status IN ('AGENDADO', 'CONFIRMADO') AND data_hora_inicio > NOW() LIMIT 1`,
      [agendamentoId],
    );
    return rows.length > 0;
  }

  private mapDetalhado(row: RowDataPacket): LembreteDetalhado {
    return {
      lembrete: this.mapRow(row),
      clienteNome: row.cliente_nome,
      profissionalNome: row.profissional_nome,
      servicoNome: row.servico_nome,
      inicioAgendamento: new Date(row.agendamento_inicio),
    };
  }

  protected mapRow(row: RowDataPacket): Lembrete {
    return Lembrete.restaurar(
      Number(row.id),
      {
        agendamentoId: Number(row.agendamento_id),
        canal: row.canal,
        destinatario: row.destinatario ?? null,
        status: row.status,
        tentativas: Number(row.tentativas),
        agendadoPara: new Date(row.agendado_para),
        enviadoEm: row.enviado_em ? new Date(row.enviado_em) : null,
        erro: row.erro ?? null,
      },
      Number(row.ativo) === 1,
    );
  }

  protected toRow(data: Partial<LembreteProps>): RowValues {
    return {
      agendamento_id: data.agendamentoId,
      canal: data.canal,
      destinatario: data.destinatario,
      status: data.status,
      tentativas: data.tentativas,
      agendado_para: data.agendadoPara,
      enviado_em: data.enviadoEm,
      erro: data.erro,
    };
  }
}
