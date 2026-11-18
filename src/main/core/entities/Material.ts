import type { CategoriaValor } from '../../../shared/dtos';
import type { MoedaValor } from '../../../shared/estoque';
import { ConflictError, ValidacaoCampos, textoOpcional } from './DomainErrors';
import { Servico } from './Servico';

const QUANTIDADE_MAXIMA = 99_999_999.99;
const PRECO_MAXIMO = 99_999_999.99;

export interface MaterialProps {
  nome: string;
  categoria: CategoriaValor;
  unidade: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  precoCustoUsd: number | null;
  precoCustoBrl: number | null;
  cotacaoUsada: number | null;
  cotacaoEm: Date | null;
  fornecedor: string | null;
}

/** Dados cadastrais editáveis (o saldo só muda por movimentação; o preço, por definirPreco). */
export interface DadosMaterial {
  nome: string;
  categoria: CategoriaValor;
  unidade: string;
  estoqueMinimo: number;
  fornecedor?: string | null;
}

/** Arredonda para `casas` decimais evitando erros de ponto flutuante (ex.: 0,1 + 0,2). */
export function arredondar(valor: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

function decimalValido(v: number, max: number, casas = 2): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max && Math.abs(arredondar(v, casas) - v) < 1e-9;
}

/** Material do estoque (tintas, agulhas, luvas, séruns...), com custo em USD e BRL. */
export class Material {
  private _props: MaterialProps;

  private constructor(
    private readonly _id: number | null,
    props: MaterialProps,
    private readonly _ativo: boolean,
  ) {
    this._props = props;
  }

  /** Novo material com saldo zero (a quantidade inicial entra como movimentação). */
  public static criar(dados: DadosMaterial): Material {
    return new Material(
      null,
      {
        ...Material.normalizar(dados),
        quantidadeAtual: 0,
        precoCustoUsd: null,
        precoCustoBrl: null,
        cotacaoUsada: null,
        cotacaoEm: null,
      },
      true,
    );
  }

  public static restaurar(id: number, props: MaterialProps, ativo: boolean): Material {
    return new Material(id, props, ativo);
  }

  public get id(): number | null { return this._id; }
  public get nome(): string { return this._props.nome; }
  public get categoria(): CategoriaValor { return this._props.categoria; }
  public get unidade(): string { return this._props.unidade; }
  public get quantidadeAtual(): number { return this._props.quantidadeAtual; }
  public get estoqueMinimo(): number { return this._props.estoqueMinimo; }
  public get precoCustoUsd(): number | null { return this._props.precoCustoUsd; }
  public get precoCustoBrl(): number | null { return this._props.precoCustoBrl; }
  public get cotacaoUsada(): number | null { return this._props.cotacaoUsada; }
  public get cotacaoEm(): Date | null { return this._props.cotacaoEm ? new Date(this._props.cotacaoEm) : null; }
  public get fornecedor(): string | null { return this._props.fornecedor; }
  public get ativo(): boolean { return this._ativo; }

  /** Alerta de estoque baixo: quantidade atual <= estoque mínimo. */
  public get estoqueBaixo(): boolean {
    return this._props.quantidadeAtual <= this._props.estoqueMinimo;
  }

  public get valorEstoqueBrl(): number | null {
    return this._props.precoCustoBrl === null ? null : arredondar(this._props.quantidadeAtual * this._props.precoCustoBrl);
  }

  public get valorEstoqueUsd(): number | null {
    return this._props.precoCustoUsd === null ? null : arredondar(this._props.quantidadeAtual * this._props.precoCustoUsd);
  }

  public atualizarDados(dados: DadosMaterial): void {
    this._props = { ...this._props, ...Material.normalizar(dados) };
  }

  /**
   * Define o preço de custo na moeda informada e calcula o outro pela cotação (1 USD = `cotacao` BRL).
   * Sem cotação disponível, só é possível informar em BRL (o valor em USD fica vazio).
   */
  public definirPreco(moeda: MoedaValor, valor: number, cotacao: number | null, cotacaoEm: Date | null): void {
    new ValidacaoCampos()
      .check(moeda === 'USD' || moeda === 'BRL', 'precoCusto.moeda', 'Moeda deve ser USD ou BRL.')
      .check(decimalValido(valor, PRECO_MAXIMO), 'precoCusto.valor', 'Preço deve ser maior ou igual a zero, com até 2 casas decimais.')
      .check(cotacao === null || (Number.isFinite(cotacao) && cotacao > 0), 'cotacao', 'Cotação inválida.')
      .throwIfAny();
    if (moeda === 'USD' && cotacao === null) {
      throw new ConflictError('Cotação do dólar indisponível: informe o preço em BRL ou tente novamente mais tarde.');
    }
    const cot = cotacao === null ? null : arredondar(cotacao, 4);
    this._props = {
      ...this._props,
      precoCustoUsd: moeda === 'USD' ? valor : cot ? arredondar(valor / cot) : null,
      precoCustoBrl: moeda === 'BRL' ? valor : arredondar(valor * (cot as number)),
      cotacaoUsada: cot,
      cotacaoEm: cot ? cotacaoEm : null,
    };
  }

  /** Recalcula o BRL a partir do USD com uma nova cotação. Devolve false se não houver preço em USD. */
  public recalcularBrl(cotacao: number, cotacaoEm: Date): boolean {
    if (this._props.precoCustoUsd === null) return false;
    const cot = arredondar(cotacao, 4);
    this._props = {
      ...this._props,
      precoCustoBrl: arredondar(this._props.precoCustoUsd * cot),
      cotacaoUsada: cot,
      cotacaoEm,
    };
    return true;
  }

  public removerPreco(): void {
    this._props = { ...this._props, precoCustoUsd: null, precoCustoBrl: null, cotacaoUsada: null, cotacaoEm: null };
  }

  /** Aplica uma variação de saldo; o saldo nunca fica negativo. */
  public aplicarVariacao(delta: number): void {
    const novo = arredondar(this._props.quantidadeAtual + delta);
    if (novo < 0) {
      throw new ConflictError(
        `Saldo insuficiente de "${this.nome}": disponível ${this._props.quantidadeAtual} ${this.unidade}, saída de ${arredondar(-delta)}.`,
      );
    }
    if (novo > QUANTIDADE_MAXIMA) throw new ConflictError('Quantidade acima do limite permitido.');
    this._props = { ...this._props, quantidadeAtual: novo };
  }

  public toProps(): MaterialProps {
    return { ...this._props };
  }

  public static quantidadeValida(q: number): boolean {
    return decimalValido(q, QUANTIDADE_MAXIMA);
  }

  private static normalizar(d: DadosMaterial): Pick<MaterialProps, 'nome' | 'categoria' | 'unidade' | 'estoqueMinimo' | 'fornecedor'> {
    const nome = (d.nome ?? '').trim().replace(/\s+/g, ' ');
    const unidade = (d.unidade ?? '').trim().toLowerCase();
    const fornecedor = textoOpcional(d.fornecedor);
    new ValidacaoCampos()
      .check(nome.length >= 2 && nome.length <= 120, 'nome', 'Nome deve ter entre 2 e 120 caracteres.')
      .check(Servico.isCategoria(d.categoria), 'categoria', 'Categoria deve ser TATUAGEM ou ESTETICA.')
      .check(unidade.length >= 1 && unidade.length <= 20, 'unidade', 'Unidade deve ter de 1 a 20 caracteres (ex.: frasco, caixa).')
      .check(decimalValido(d.estoqueMinimo, QUANTIDADE_MAXIMA), 'estoqueMinimo', 'Estoque mínimo deve ser maior ou igual a zero, com até 2 casas decimais.')
      .check((fornecedor?.length ?? 0) <= 120, 'fornecedor', 'Fornecedor muito longo (máx. 120).')
      .throwIfAny();
    return { nome, categoria: d.categoria, unidade, estoqueMinimo: d.estoqueMinimo, fornecedor };
  }
}
