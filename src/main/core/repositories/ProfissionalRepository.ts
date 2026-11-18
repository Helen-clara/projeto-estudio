import { RowDataPacket } from 'mysql2/promise';
import type { EspecialidadeValor } from '../../../shared/dtos';
import { BaseRepository, FindAllOptions, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Profissional, ProfissionalProps, Servico } from '../entities';
import { ServicoRepository } from './ServicoRepository';
import { SqlFiltros } from './SqlFiltros';

/** Dados gravados de um profissional; `senhaHash` só é usado na criação. */
export type ProfissionalGravacao = ProfissionalProps & { senhaHash?: string };

export interface BuscaProfissionais {
  termo?: string;
  especialidade?: EspecialidadeValor;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

/** Campos de `usuarios` que precisam ser únicos (nome de coluna fixo, nunca vindo do usuário). */
export type CampoUnicoUsuario = 'login' | 'email' | 'cpf';

/**
 * Profissionais = linhas de `usuarios` com perfil PROFISSIONAL.
 * Todas as consultas filtram pelo perfil e nunca selecionam `senha_hash`.
 */
export class ProfissionalRepository extends BaseRepository<Profissional, ProfissionalGravacao> {
  private static readonly COLUNAS = 'u.id, u.nome, u.cpf, u.email, u.telefone, u.login, u.especialidade, u.ativo';
  private static readonly SOMENTE_PROFISSIONAIS = "u.perfil = 'PROFISSIONAL'";
  private static readonly CAMPOS_UNICOS: Readonly<Record<CampoUnicoUsuario, string>> = {
    login: 'login',
    email: 'email',
    cpf: 'cpf',
  };

  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'usuarios',
        writableColumns: ['nome', 'cpf', 'email', 'telefone', 'login', 'senha_hash', 'perfil', 'especialidade'],
        sortableColumns: ['nome', 'login', 'especialidade'],
      },
      db,
    );
  }

  public override async findById(id: number): Promise<Profissional | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT ${ProfissionalRepository.COLUNAS} FROM usuarios u
        WHERE u.id = ? AND ${ProfissionalRepository.SOMENTE_PROFISSIONAIS} LIMIT 1`,
      [id],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  public override async findAll(options: FindAllOptions = {}): Promise<Page<Profissional>> {
    return this.buscar({ ativo: options.ativo, limit: options.limit, offset: options.offset });
  }

  public override async exists(id: number): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  public override async update(id: number, data: Partial<ProfissionalGravacao>): Promise<Profissional | null> {
    return (await this.exists(id)) ? super.update(id, data) : null;
  }

  public override async softDelete(id: number): Promise<boolean> {
    return (await this.exists(id)) && super.softDelete(id);
  }

  public override async restore(id: number): Promise<boolean> {
    return (await this.exists(id)) && super.restore(id);
  }

  public async buscar(busca: BuscaProfissionais = {}): Promise<Page<Profissional>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const filtros = new SqlFiltros()
      .add(ProfissionalRepository.SOMENTE_PROFISSIONAIS)
      .ativo('u.ativo', busca.ativo ?? true);
    const termo = busca.termo?.trim();
    if (termo) {
      const like = SqlFiltros.like(termo);
      filtros.add('(u.nome LIKE ? OR u.login LIKE ?)', like, like);
    }
    if (busca.especialidade) filtros.add('u.especialidade = ?', busca.especialidade);

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM usuarios u${filtros.where}`,
      filtros.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `SELECT ${ProfissionalRepository.COLUNAS} FROM usuarios u${filtros.where}
        ORDER BY u.nome ASC, u.id ASC LIMIT ? OFFSET ?`,
      [...filtros.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapRow(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  /**
   * Algum usuário (de qualquer perfil, ativo ou não) já usa este login/e-mail/CPF?
   * `ignorarId` permite editar o próprio registro sem acusar conflito.
   */
  public async existeUsuarioCom(campo: CampoUnicoUsuario, valor: string, ignorarId?: number): Promise<boolean> {
    const coluna = ProfissionalRepository.CAMPOS_UNICOS[campo];
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM usuarios WHERE ${coluna} = ? AND id <> ? LIMIT 1`,
      [valor, ignorarId ?? 0],
    );
    return rows.length > 0;
  }

  // ------------------------------------------------------------- N:N com serviços

  /** Serviços com vínculo ativo. `apenasServicosAtivos` esconde serviços inativados. */
  public async listarServicos(profissionalId: number, apenasServicosAtivos = true): Promise<Servico[]> {
    BaseRepository.assertId(profissionalId);
    const filtroServico = apenasServicosAtivos ? ' AND s.ativo = 1' : '';
    const rows = await this.db.query<RowDataPacket>(
      `SELECT s.* FROM profissional_servicos ps
         JOIN servicos s ON s.id = ps.servico_id
        WHERE ps.profissional_id = ? AND ps.ativo = 1${filtroServico}
        ORDER BY s.nome ASC`,
      [profissionalId],
    );
    return rows.map((r) => ServicoRepository.fromRow(r));
  }

  /** Cria o vínculo ou reativa um vínculo inativado. */
  public async vincularServico(profissionalId: number, servicoId: number): Promise<void> {
    BaseRepository.assertId(profissionalId);
    BaseRepository.assertId(servicoId);
    await this.db.execute(
      `INSERT INTO profissional_servicos (profissional_id, servico_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ativo = 1`,
      [profissionalId, servicoId],
    );
  }

  /** Exclusão lógica do vínculo. Devolve false se não havia vínculo ativo. */
  public async desvincularServico(profissionalId: number, servicoId: number): Promise<boolean> {
    BaseRepository.assertId(profissionalId);
    BaseRepository.assertId(servicoId);
    const result = await this.db.execute(
      'UPDATE profissional_servicos SET ativo = 0 WHERE profissional_id = ? AND servico_id = ? AND ativo = 1',
      [profissionalId, servicoId],
    );
    return result.affectedRows > 0;
  }

  /** Desativa todos os vínculos do profissional (usado ao redefinir a lista). */
  public async desvincularTodos(profissionalId: number): Promise<void> {
    BaseRepository.assertId(profissionalId);
    await this.db.execute('UPDATE profissional_servicos SET ativo = 0 WHERE profissional_id = ?', [profissionalId]);
  }

  /** Há agendamento futuro em aberto para este profissional? */
  public async temAgendamentoFuturo(profissionalId: number): Promise<boolean> {
    BaseRepository.assertId(profissionalId);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM agendamentos
        WHERE profissional_id = ? AND ativo = 1 AND data_hora_inicio > NOW()
          AND status IN ('AGENDADO', 'CONFIRMADO')
        LIMIT 1`,
      [profissionalId],
    );
    return rows.length > 0;
  }

  protected mapRow(row: RowDataPacket): Profissional {
    return Profissional.restaurar(
      Number(row.id),
      {
        nome: row.nome,
        cpf: row.cpf ?? null,
        email: row.email,
        telefone: row.telefone ?? null,
        login: row.login,
        especialidade: row.especialidade,
      },
      Number(row.ativo) === 1,
    );
  }

  protected toRow(data: Partial<ProfissionalGravacao>): RowValues {
    return {
      nome: data.nome,
      cpf: data.cpf,
      email: data.email,
      telefone: data.telefone,
      login: data.login,
      especialidade: data.especialidade,
      senha_hash: data.senhaHash,
      // Este repository só grava profissionais.
      perfil: 'PROFISSIONAL',
    };
  }
}
