import { RowDataPacket } from 'mysql2/promise';
import { BaseRepository, Page, RowValues } from '../database/BaseRepository';
import { SqlExecutor } from '../database/Database';
import { Cliente, ClienteProps, Endereco } from '../entities';
import { DataNascimentoValidator } from '../validators';
import { SqlFiltros } from './SqlFiltros';

export interface BuscaClientes {
  /** Parte do nome ou início do CPF. */
  termo?: string;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

export class ClienteRepository extends BaseRepository<Cliente, ClienteProps> {
  constructor(db?: SqlExecutor) {
    super(
      {
        table: 'clientes',
        writableColumns: [
          'nome', 'cpf', 'data_nascimento', 'telefone', 'email', 'observacoes',
          'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
        ],
        sortableColumns: ['nome', 'cpf', 'data_nascimento'],
      },
      db,
    );
  }

  /** Busca paginada por nome (contém) ou CPF (começa com), ordenada por nome. */
  public async buscar(busca: BuscaClientes = {}): Promise<Page<Cliente>> {
    const { limit, offset } = BaseRepository.pagination(busca.limit, busca.offset);
    const filtros = new SqlFiltros().ativo('ativo', busca.ativo ?? true);

    const termo = busca.termo?.trim();
    if (termo) {
      const digitos = termo.replace(/\D/g, '');
      if (digitos.length >= 3 && /^[\d.\-\s]+$/.test(termo)) {
        filtros.add('cpf LIKE ?', SqlFiltros.like(digitos, 'comeca'));
      } else {
        filtros.add('nome LIKE ?', SqlFiltros.like(termo));
      }
    }

    const [total] = await this.db.query<RowDataPacket>(
      `SELECT COUNT(*) AS total FROM clientes${filtros.where}`,
      filtros.params,
    );
    const rows = await this.db.query<RowDataPacket>(
      `SELECT * FROM clientes${filtros.where} ORDER BY nome ASC, id ASC LIMIT ? OFFSET ?`,
      [...filtros.params, ...SqlFiltros.paginacao(limit, offset)],
    );
    return { items: rows.map((r) => this.mapRow(r)), total: Number(total?.total ?? 0), limit, offset };
  }

  /** Procura pelo CPF (só dígitos), ativo ou não. */
  public async findByCpf(cpf: string): Promise<Cliente | null> {
    const rows = await this.db.query<RowDataPacket>('SELECT * FROM clientes WHERE cpf = ? LIMIT 1', [cpf]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  protected mapRow(row: RowDataPacket): Cliente {
    const nascimento = row.data_nascimento instanceof Date
      ? DataNascimentoValidator.toIso(row.data_nascimento)
      : String(row.data_nascimento);

    const endereco = row.cep
      ? new Endereco({
          cep: row.cep,
          logradouro: row.logradouro,
          numero: row.numero,
          complemento: row.complemento,
          bairro: row.bairro,
          cidade: row.cidade,
          uf: row.uf,
        })
      : null;

    return Cliente.restaurar(
      Number(row.id),
      {
        nome: row.nome,
        cpf: row.cpf,
        dataNascimento: nascimento,
        telefone: row.telefone ?? null,
        email: row.email ?? null,
        observacoes: row.observacoes ?? null,
        endereco,
      },
      Number(row.ativo) === 1,
    );
  }

  protected toRow(data: Partial<ClienteProps>): RowValues {
    const row: RowValues = {
      nome: data.nome,
      cpf: data.cpf,
      data_nascimento: data.dataNascimento,
      telefone: data.telefone,
      email: data.email,
      observacoes: data.observacoes,
    };
    if (data.endereco !== undefined) {
      const e = data.endereco;
      Object.assign(row, {
        cep: e?.cep ?? null,
        logradouro: e?.logradouro ?? null,
        numero: e?.numero ?? null,
        complemento: e?.complemento ?? null,
        bairro: e?.bairro ?? null,
        cidade: e?.cidade ?? null,
        uf: e?.uf ?? null,
      });
    }
    return row;
  }
}
