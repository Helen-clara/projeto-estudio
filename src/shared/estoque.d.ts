/**
 * Tipos do estoque de materiais (preço de custo em USD e BRL, movimentações e relatórios).
 * Arquivo só de tipos (.d.ts) para ser usado também pelo renderer.
 */
import type { CategoriaValor, PaginaDTO } from './dtos';

export type MoedaValor = 'USD' | 'BRL';
export type TipoMovimentacaoValor = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

// ---------------------------------------------------------------- Cotação

export interface CotacaoDTO {
  /** Valor de compra (bid) de 1 USD em BRL. */
  valor: number;
  /** 'AAAA-MM-DDTHH:mm:ss' (horário local) da cotação. */
  dataHora: string;
  /** De onde veio: API agora, cache em memória, arquivo local ou último valor gravado no banco. */
  fonte: 'API' | 'CACHE' | 'ARQUIVO' | 'BANCO';
  /** true quando a API não respondeu e foi usado um valor guardado. */
  desatualizada: boolean;
  aviso?: string;
}

// ---------------------------------------------------------------- Materiais

export interface PrecoCustoInput {
  moeda: MoedaValor;
  /** Valor na moeda informada; o outro é calculado pela cotação atual. */
  valor: number;
}

export interface MaterialInput {
  nome: string;
  categoria: CategoriaValor;
  /** Ex.: frasco, caixa, unidade, pote. */
  unidade: string;
  estoqueMinimo: number;
  /** null = sem preço de custo. */
  precoCusto?: PrecoCustoInput | null;
  fornecedor?: string | null;
  /** Só na criação: gera uma ENTRADA inicial. Depois, o saldo muda apenas por movimentações. */
  quantidadeInicial?: number;
}

export interface MaterialDTO {
  id: number;
  nome: string;
  categoria: CategoriaValor;
  unidade: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  estoqueBaixo: boolean;
  precoCustoUsd: number | null;
  precoCustoBrl: number | null;
  cotacaoUsada: number | null;
  /** 'AAAA-MM-DDTHH:mm:ss' */
  cotacaoEm: string | null;
  fornecedor: string | null;
  /** quantidadeAtual × preço (null sem preço). */
  valorEstoqueBrl: number | null;
  valorEstoqueUsd: number | null;
  ativo: boolean;
}

export interface MaterialSalvoDTO {
  material: MaterialDTO;
  avisos: string[];
}

export interface FiltroMateriais {
  termo?: string;
  categoria?: CategoriaValor;
  apenasEstoqueBaixo?: boolean;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------- Movimentações

export interface MovimentacaoInput {
  materialId: number;
  tipo: TipoMovimentacaoValor;
  /** ENTRADA/SAIDA: quantidade movimentada (> 0). AJUSTE: novo saldo contado no inventário (>= 0). */
  quantidade: number;
  /** Obrigatório no AJUSTE. */
  motivo?: string | null;
  /** Saída ligada a um atendimento (obrigatório para PROFISSIONAL). */
  agendamentoId?: number | null;
}

export interface MovimentacaoDTO {
  id: number;
  materialId: number;
  materialNome: string;
  unidade: string;
  tipo: TipoMovimentacaoValor;
  /** Sempre positiva; o sentido é dado por `efeito`. */
  quantidade: number;
  /** +1 aumenta o saldo, -1 diminui. */
  efeito: 1 | -1;
  motivo: string | null;
  agendamentoId: number | null;
  usuarioId: number | null;
  usuarioNome: string | null;
  data: string;
  /** false = estornada. */
  ativo: boolean;
}

export interface MovimentacaoRegistradaDTO {
  movimentacao: MovimentacaoDTO;
  material: MaterialDTO;
  /** Ex.: estoque ficou abaixo do mínimo. */
  avisos: string[];
}

export interface FiltroMovimentacoes {
  materialId?: number;
  tipo?: TipoMovimentacaoValor;
  agendamentoId?: number;
  dataInicio?: string;
  dataFim?: string;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------- Relatórios

export interface ValorCategoriaDTO {
  categoria: CategoriaValor;
  itens: number;
  valorBrl: number;
  valorUsd: number;
}

export interface RelatorioEstoqueDTO {
  geradoEm: string;
  totalItens: number;
  itensEstoqueBaixo: number;
  itensSemPreco: number;
  valorTotalBrl: number;
  valorTotalUsd: number;
  porCategoria: ValorCategoriaDTO[];
  cotacaoAtual: CotacaoDTO | null;
}

export interface RecalculoPrecosDTO {
  cotacao: CotacaoDTO;
  atualizados: number;
  /** Materiais sem preço em USD (não há o que recalcular). */
  ignorados: number;
  avisos: string[];
}

export interface ConsumoItemDTO {
  chave: string;
  rotulo: string;
  quantidade: number;
  valorBrl: number;
}

export interface ConsumoPeriodoDTO {
  dataInicio: string;
  dataFim: string;
  porCategoria: ConsumoItemDTO[];
  porMaterial: ConsumoItemDTO[];
  valorTotalBrl: number;
}

export type PaginaMateriaisDTO = PaginaDTO<MaterialDTO>;
export type PaginaMovimentacoesDTO = PaginaDTO<MovimentacaoDTO>;

export type CanalEstoque =
  | 'estoque:listar'
  | 'estoque:obter'
  | 'estoque:salvar'
  | 'estoque:inativar'
  | 'estoque:reativar'
  | 'estoque:movimentar'
  | 'estoque:movimentacoes'
  | 'estoque:editarMotivo'
  | 'estoque:estornar'
  | 'estoque:alertas'
  | 'estoque:cotacaoAtual'
  | 'estoque:recalcularPrecos'
  | 'estoque:relatorio'
  | 'estoque:consumo';
