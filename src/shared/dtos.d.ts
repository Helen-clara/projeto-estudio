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

// ---------------------------------------------------------------- Autenticação e usuários

export type PerfilValor = 'ADMIN' | 'RECEPCAO' | 'PROFISSIONAL';

/** Usuário logado (nunca inclui senha ou hash). */
export interface UsuarioSessaoDTO {
  id: number;
  nome: string;
  login: string;
  perfil: PerfilValor;
  especialidade: EspecialidadeValor | null;
  /** Permissões do perfil (valores do enum Permissao), para a tela esconder o que não pode usar. */
  permissoes: string[];
  /** ISO 8601: quando a sessão expira se não houver atividade. */
  expiraEm: string;
}

export interface LoginPayload {
  login: string;
  senha: string;
}

export interface TrocarSenhaPayload {
  senhaAtual: string;
  novaSenha: string;
}

export interface UsuarioInput {
  nome: string;
  cpf?: string | null;
  email: string;
  telefone?: string | null;
  login: string;
  perfil: PerfilValor;
  /** Obrigatória para PROFISSIONAL; deve ser vazia para os outros perfis. */
  especialidade?: EspecialidadeValor | null;
  /** Obrigatória ao criar; ignorada ao editar (use resetarSenha). */
  senha?: string;
}

export interface UsuarioDTO {
  id: number;
  nome: string;
  cpf: string | null;
  email: string;
  telefone: string | null;
  login: string;
  perfil: PerfilValor;
  especialidade: EspecialidadeValor | null;
  ativo: boolean;
  /** ISO 8601 ou null se nunca acessou. */
  ultimoAcesso: string | null;
  bloqueado: boolean;
}

export interface FiltroUsuarios extends FiltroListagem {
  perfil?: PerfilValor;
}

export interface ResetarSenhaPayload {
  id: number;
  novaSenha: string;
}

// ---------------------------------------------------------------- Canais IPC

export type CanalAuth =
  | 'auth:login'
  | 'auth:logout'
  | 'auth:usuarioAtual'
  | 'auth:trocarSenha'
  | 'usuarios:listar'
  | 'usuarios:obter'
  | 'usuarios:salvar'
  | 'usuarios:inativar'
  | 'usuarios:reativar'
  | 'usuarios:resetarSenha';

/** Canais IPC dos cadastros (main e preload usam este tipo, então um nome errado não compila). */
export type CanalCadastro =
  | 'clientes:listar'
  | 'clientes:obter'
  | 'clientes:salvar'
  | 'clientes:inativar'
  | 'clientes:reativar'
  | 'clientes:buscarCep'
  | 'servicos:listar'
  | 'servicos:obter'
  | 'servicos:salvar'
  | 'servicos:inativar'
  | 'servicos:reativar'
  | 'profissionais:listar'
  | 'profissionais:obter'
  | 'profissionais:salvar'
  | 'profissionais:inativar'
  | 'profissionais:reativar'
  | 'profissionais:listarServicos'
  | 'profissionais:vincularServico'
  | 'profissionais:desvincularServico'
  | 'profissionais:definirServicos';
