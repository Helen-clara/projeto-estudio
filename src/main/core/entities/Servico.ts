import type { CategoriaValor, ServicoDTO, ServicoInput } from '../../../shared/dtos';
import { ValidacaoCampos, textoOpcional } from './DomainErrors';

const CATEGORIAS: readonly CategoriaValor[] = ['TATUAGEM', 'ESTETICA'];
const DURACAO_MAXIMA_MINUTOS = 12 * 60;
const PRECO_MAXIMO = 99_999_999.99;

export interface ServicoProps {
  nome: string;
  descricao: string | null;
  categoria: CategoriaValor;
  duracaoMinutos: number;
  preco: number;
}

/** Procedimento oferecido pelo estúdio (tatuagem ou estética). */
export class Servico {
  private _nome!: string;
  private _descricao!: string | null;
  private _categoria!: CategoriaValor;
  private _duracaoMinutos!: number;
  private _preco!: number;

  private constructor(
    private readonly _id: number | null,
    props: ServicoProps,
    private readonly _ativo: boolean,
  ) {
    this.aplicar(props);
  }

  public static criar(input: ServicoInput): Servico {
    return new Servico(null, Servico.normalizar(input), true);
  }

  public static restaurar(id: number, props: ServicoProps, ativo: boolean): Servico {
    return new Servico(id, props, ativo);
  }

  public atualizar(input: ServicoInput): void {
    this.aplicar(Servico.normalizar(input));
  }

  public static isCategoria(valor: unknown): valor is CategoriaValor {
    return typeof valor === 'string' && (CATEGORIAS as readonly string[]).includes(valor);
  }

  public get id(): number | null { return this._id; }
  public get nome(): string { return this._nome; }
  public get descricao(): string | null { return this._descricao; }
  public get categoria(): CategoriaValor { return this._categoria; }
  public get duracaoMinutos(): number { return this._duracaoMinutos; }
  public get preco(): number { return this._preco; }
  public get ativo(): boolean { return this._ativo; }

  public toProps(): ServicoProps {
    return {
      nome: this._nome,
      descricao: this._descricao,
      categoria: this._categoria,
      duracaoMinutos: this._duracaoMinutos,
      preco: this._preco,
    };
  }

  public toDTO(): ServicoDTO {
    if (this._id === null) {
      throw new Error('Serviço ainda não foi salvo.');
    }
    return { id: this._id, ...this.toProps(), ativo: this._ativo };
  }

  private aplicar(props: ServicoProps): void {
    this._nome = props.nome;
    this._descricao = props.descricao;
    this._categoria = props.categoria;
    this._duracaoMinutos = props.duracaoMinutos;
    this._preco = props.preco;
  }

  private static normalizar(input: ServicoInput): ServicoProps {
    const nome = (input.nome ?? '').trim().replace(/\s+/g, ' ');
    const descricao = textoOpcional(input.descricao);
    const { categoria, duracaoMinutos, preco } = input;

    new ValidacaoCampos()
      .check(nome.length >= 3 && nome.length <= 120, 'nome', 'Nome deve ter entre 3 e 120 caracteres.')
      .check((descricao?.length ?? 0) <= 500, 'descricao', 'Descrição muito longa (máx. 500).')
      .check(Servico.isCategoria(categoria), 'categoria', 'Categoria deve ser TATUAGEM ou ESTETICA.')
      .check(
        Number.isInteger(duracaoMinutos) && duracaoMinutos > 0 && duracaoMinutos <= DURACAO_MAXIMA_MINUTOS,
        'duracaoMinutos',
        `Duração deve ser um número inteiro de minutos entre 1 e ${DURACAO_MAXIMA_MINUTOS}.`,
      )
      .check(
        typeof preco === 'number' && Number.isFinite(preco) && preco >= 0 && preco <= PRECO_MAXIMO &&
          Math.abs(Math.round(preco * 100) - preco * 100) < 1e-6,
        'preco',
        'Preço deve ser um valor em reais maior ou igual a zero, com até 2 casas decimais.',
      )
      .throwIfAny();

    return { nome, descricao, categoria, duracaoMinutos, preco: Math.round(preco * 100) / 100 };
  }
}
