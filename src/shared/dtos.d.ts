/**
 * DTOs trafegados entre main ⇄ preload ⇄ renderer.
 *
 * Arquivo só de tipos (.d.ts) para poder ser importado também pelo renderer,
 * que compila com rootDir em src/renderer. Os valores literais espelham os
 * enums de src/shared/types.ts (Perfil, Especialidade, CategoriaServico).
 */

export type CategoriaValor = 'TATUAGEM' | 'ESTETICA';
export type EspecialidadeValor = 'TATUADOR' | 'ESTETICISTA';

/** Envelope padrão de resposta IPC (mesmo formato de ApiResponse<T>). */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PaginaDTO<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Filtro comum de listagem. `ativo`: true (padrão) = só ativos, false = só inativos, 'todos'. */
export interface FiltroListagem {
  termo?: string;
  ativo?: boolean | 'todos';
  limit?: number;
  offset?: number;
}

/** Payload para criar (sem id) ou editar (com id). */
export interface SalvarPayload<T> {
  id?: number;
  dados: T;
}

// ---------------------------------------------------------------- Endereço

export interface EnderecoDTO {
  cep: string;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export interface ConsultaCepDTO {
  encontrado: boolean;
  endereco: EnderecoDTO | null;
  /** Explica por que não encontrou (CEP inválido, inexistente, sem internet...). */
  mensagem?: string;
}

// ---------------------------------------------------------------- Clientes

export interface ClienteInput {
  nome: string;
  cpf: string;
  /** AAAA-MM-DD */
  dataNascimento: string;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
  endereco?: EnderecoDTO | null;
}

export interface ClienteDTO {
  id: number;
  nome: string;
  cpf: string;
  dataNascimento: string;
  idade: number;
  menorDeIdade: boolean;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  endereco: EnderecoDTO | null;
  ativo: boolean;
}

export interface ClienteSalvoDTO {
  cliente: ClienteDTO;
  /** Avisos que não impedem o cadastro (ex.: cliente menor de idade). */
  avisos: string[];
}

// ---------------------------------------------------------------- Serviços

export interface ServicoInput {
  nome: string;
  descricao?: string | null;
  categoria: CategoriaValor;
  duracaoMinutos: number;
  /** Preço em BRL. */
  preco: number;
}

export interface ServicoDTO {
  id: number;
  nome: string;
  descricao: string | null;
  categoria: CategoriaValor;
  duracaoMinutos: number;
  preco: number;
  ativo: boolean;
}

export interface FiltroServicos extends FiltroListagem {
  categoria?: CategoriaValor;
}

// ---------------------------------------------------------------- Profissionais

export interface ProfissionalInput {
  nome: string;
  cpf?: string | null;
  email: string;
  telefone?: string | null;
  login: string;
  especialidade: EspecialidadeValor;
  /** Obrigatória ao criar; ignorada ao editar (troca de senha fica no módulo de autenticação). */
  senha?: string;
}

export interface ProfissionalDTO {
  id: number;
  nome: string;
  cpf: string | null;
  email: string;
  telefone: string | null;
  login: string;
  especialidade: EspecialidadeValor;
  ativo: boolean;
  /** Preenchido em `obter` (serviços vinculados e ativos). */
  servicos?: ServicoDTO[];
}

export interface FiltroProfissionais extends FiltroListagem {
  especialidade?: EspecialidadeValor;
}

export interface VinculoPayload {
  profissionalId: number;
  servicoId: number;
}

export interface DefinirServicosPayload {
  profissionalId: number;
  servicoIds: number[];
}
