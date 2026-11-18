import { RowDataPacket } from 'mysql2/promise';
import type { PerfilValor } from '../../../shared/dtos';
import { BaseRepository, FindAllOptions, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Usuario, UsuarioProps } from '../entities/Usuario';
import { SqlFiltros } from './SqlFiltros';

/** Dados gravados; `senhaHash` só na criação (troca de senha tem método próprio). */
export type UsuarioGravacao = UsuarioProps & { senhaHash?: string };

/** Uso exclusivo do login: inclui o hash e o estado de bloqueio. Nunca sai do processo main. */
export interface CredenciaisUsuario {
  usuario: Usuario;
  senhaHash: string;
  /** Segundos restantes de bloqueio (0 = não bloqueado). Calculado pelo MySQL, sem problema de fuso. */
  segundosBloqueio: number;
}

export interface BuscaUsuarios {
  termo?: string;
  perfil?: PerfilValor;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

/** Acesso à tabela `usuarios` (todos os perfis). Consultas comuns nunca selecionam `senha_hash`. */
export class UsuarioRepository extends BaseRepository<Usuario, UsuarioGravacao> {
  private static readonly COLUNAS =
    'id, nome, cpf, email, telefone, login, perfil, especialidade, ativo, ultimo_acesso, ' +
    '(bloqueado_ate IS NOT NULL AND bloqueado_ate > NOW()) AS bloqueado';

  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'usuarios',
        writableColumns: ['nome', 'cpf', 'email', 'telefone', 'login', 'perfil', 'especialidade', 'senha_hash'],
        sortableColumns: ['nome', 'login', 'perfil'],
      },
      db,
    );
  }

  public override async findById(id: number): Promise<Usuario | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT ${UsuarioRepository.COLUNAS} FROM usuarios WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  public override async findAll(options: FindAllOptions = {}): Promise<Page<Usuario>> {
    return this.buscar({ ativo: options.ativo, limit: options.limit, offset: options.offset });
  }

  public async buscar(busca: BuscaUsuarios = {}): Promise<Page<Usuario>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const filtros = new SqlFiltros().ativo('ativo', busca.ativo ?? true);
    const termo = busca.termo?.trim();
    if (termo) {
      const like = SqlFiltros.like(termo);
      filtros.add('(nome LIKE ? OR login LIKE ? OR email LIKE ?)', like, like, like);
    }
    if (busca.perfil) filtros.add('perfil = ?', busca.perfil);

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM usuarios${filtros.where}`,
      filtros.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `SELECT ${UsuarioRepository.COLUNAS} FROM usuarios${filtros.where}
        ORDER BY nome ASC, id ASC LIMIT ? OFFSET ?`,
      [...filtros.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapRow(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  /** Hash + estado de bloqueio para autenticar. Devolve null se o login não existir. */
  public async findCredenciaisPorLogin(login: string): Promise<CredenciaisUsuario | null> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT ${UsuarioRepository.COLUNAS}, senha_hash,
              GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, NOW(), bloqueado_ate), 0), 0) AS segundos_bloqueio
         FROM usuarios WHERE login = ? LIMIT 1`,
      [login],
    );
    if (rows.length === 0) return null;
    return {
      usuario: this.mapRow(rows[0]),
      senhaHash: String(rows[0].senha_hash),
      segundosBloqueio: Number(rows[0].segundos_bloqueio),
    };
  }

  /** Hash atual de um usuário (para conferir a senha atual na troca). */
  public async findSenhaHash(id: number): Promise<string | null> {
    BaseRepository.assertId(id);
    const rows = await this.db.query<RowDataPacket>('SELECT senha_hash FROM usuarios WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? String(rows[0].senha_hash) : null;
  }

  /**
   * Soma uma tentativa errada; ao atingir `maxTentativas`, bloqueia por `minutosBloqueio`
   * e zera o contador. Tudo num único UPDATE (atômico).
   * Obs.: o MySQL aplica as atribuições do SET da esquerda para a direita.
   */
  public async registrarFalhaLogin(id: number, maxTentativas: number, minutosBloqueio: number): Promise<void> {
    BaseRepository.assertId(id);
    await this.db.execute(
      `UPDATE usuarios
          SET bloqueado_ate = IF(tentativas_login + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), bloqueado_ate),
              tentativas_login = IF(tentativas_login + 1 >= ?, 0, tentativas_login + 1)
        WHERE id = ?`,
      [maxTentativas, minutosBloqueio, maxTentativas, id],
    );
  }

  /** Login bem-sucedido: zera tentativas/bloqueio e grava o último acesso. */
  public async registrarLoginSucesso(id: number): Promise<void> {
    BaseRepository.assertId(id);
    await this.db.execute(
      'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_acesso = NOW() WHERE id = ?',
      [id],
    );
  }

  /** Grava novo hash e libera eventual bloqueio. */
  public async atualizarSenha(id: number, senhaHash: string): Promise<boolean> {
    BaseRepository.assertId(id);
    const result = await this.db.execute(
      'UPDATE usuarios SET senha_hash = ?, tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?',
      [senhaHash, id],
    );
    return result.affectedRows > 0;
  }

  /** Algum usuário (exceto `ignorarId`) já usa este valor no campo único? */
  public async existeCom(campo: 'login' | 'email' | 'cpf', valor: string, ignorarId?: number): Promise<boolean> {
    const coluna = ({ login: 'login', email: 'email', cpf: 'cpf' } as const)[campo];
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM usuarios WHERE ${coluna} = ? AND id <> ? LIMIT 1`,
      [valor, ignorarId ?? 0],
    );
    return rows.length > 0;
  }

  public async contarAdminsAtivos(): Promise<number> {
    const [row] = await this.db.query<RowDataPacket>(
      "SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'ADMIN' AND ativo = 1",
    );
    return Number(row?.total ?? 0);
  }

  /** Quantos serviços estão vinculados (vínculo ativo) a este usuário-profissional. */
  public async contarServicosVinculados(usuarioId: number): Promise<number> {
    BaseRepository.assertId(usuarioId);
    const [row] = await this.db.query<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM profissional_servicos WHERE profissional_id = ? AND ativo = 1',
      [usuarioId],
    );
    return Number(row?.total ?? 0);
  }

  public async temAgendamentoFuturo(usuarioId: number): Promise<boolean> {
    BaseRepository.assertId(usuarioId);
    const rows = await this.db.query<RowDataPacket>(
      `SELECT 1 FROM agendamentos
        WHERE profissional_id = ? AND ativo = 1 AND data_hora_inicio > NOW()
          AND status IN ('AGENDADO', 'CONFIRMADO')
        LIMIT 1`,
      [usuarioId],
    );
    return rows.length > 0;
  }

  protected mapRow(row: RowDataPacket): Usuario {
    return Usuario.restaurar(
      Number(row.id),
      {
        nome: row.nome,
        cpf: row.cpf ?? null,
        email: row.email,
        telefone: row.telefone ?? null,
        login: row.login,
        perfil: row.perfil,
        especialidade: row.especialidade ?? null,
      },
      Number(row.ativo) === 1,
      {
        ultimoAcesso: row.ultimo_acesso instanceof Date ? row.ultimo_acesso : null,
        bloqueado: Number(row.bloqueado) === 1,
      },
    );
  }

  protected toRow(data: Partial<UsuarioGravacao>): RowValues {
    return {
      nome: data.nome,
      cpf: data.cpf,
      email: data.email,
      telefone: data.telefone,
      login: data.login,
      perfil: data.perfil,
      especialidade: data.especialidade,
      senha_hash: data.senhaHash,
    };
  }
}
