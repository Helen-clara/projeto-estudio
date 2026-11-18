import type {
  ApiResult,
  ClienteDTO,
  ClienteInput,
  ClienteSalvoDTO,
  ConsultaCepDTO,
  DefinirServicosPayload,
  FiltroListagem,
  FiltroProfissionais,
  FiltroServicos,
  FiltroUsuarios,
  LoginPayload,
  PaginaDTO,
  ResetarSenhaPayload,
  TrocarSenhaPayload,
  UsuarioDTO,
  UsuarioInput,
  UsuarioSessaoDTO,
  ProfissionalDTO,
  ProfissionalInput,
  SalvarPayload,
  ServicoDTO,
  ServicoInput,
  VinculoPayload,
} from '../shared/dtos';

/** Toda chamada devolve `{ ok, data?, error? }`; nunca lança para o renderer. */
type Resposta<T> = Promise<ApiResult<T>>;

export interface ClientesAPI {
  listar(filtro?: FiltroListagem): Resposta<PaginaDTO<ClienteDTO>>;
  obter(id: number): Resposta<ClienteDTO>;
  /** Sem `id` cria; com `id` edita. `avisos` traz alertas como cliente menor de idade. */
  salvar(payload: SalvarPayload<ClienteInput>): Resposta<ClienteSalvoDTO>;
  inativar(id: number): Resposta<void>;
  reativar(id: number): Resposta<void>;
  /** Consulta o ViaCEP. Se não encontrar, `data.encontrado = false` e `data.mensagem` explica. */
  buscarCep(cep: string): Resposta<ConsultaCepDTO>;
}

export interface ServicosAPI {
  listar(filtro?: FiltroServicos): Resposta<PaginaDTO<ServicoDTO>>;
  obter(id: number): Resposta<ServicoDTO>;
  salvar(payload: SalvarPayload<ServicoInput>): Resposta<ServicoDTO>;
  inativar(id: number): Resposta<void>;
  reativar(id: number): Resposta<void>;
}

export interface ProfissionaisAPI {
  listar(filtro?: FiltroProfissionais): Resposta<PaginaDTO<ProfissionalDTO>>;
  /** Inclui `servicos` vinculados. */
  obter(id: number): Resposta<ProfissionalDTO>;
  /** Ao criar, `dados.senha` é obrigatória. */
  salvar(payload: SalvarPayload<ProfissionalInput>): Resposta<ProfissionalDTO>;
  inativar(id: number): Resposta<void>;
  reativar(id: number): Resposta<void>;
  listarServicos(profissionalId: number): Resposta<ServicoDTO[]>;
  vincularServico(payload: VinculoPayload): Resposta<ServicoDTO[]>;
  desvincularServico(payload: VinculoPayload): Resposta<ServicoDTO[]>;
  definirServicos(payload: DefinirServicosPayload): Resposta<ServicoDTO[]>;
}

export interface AuthAPI {
  /** Em caso de falha, `error` traz sempre a mesma mensagem genérica (ou o aviso de bloqueio). */
  login(payload: LoginPayload): Resposta<UsuarioSessaoDTO>;
  logout(): Resposta<void>;
  /** `data` é null quando não há sessão (ou ela expirou). */
  usuarioAtual(): Resposta<UsuarioSessaoDTO | null>;
  trocarSenha(payload: TrocarSenhaPayload): Resposta<void>;
}

/** Somente ADMIN. */
export interface UsuariosAPI {
  listar(filtro?: FiltroUsuarios): Resposta<PaginaDTO<UsuarioDTO>>;
  obter(id: number): Resposta<UsuarioDTO>;
  /** Sem `id` cria (senha obrigatória); com `id` edita (senha ignorada). */
  salvar(payload: SalvarPayload<UsuarioInput>): Resposta<UsuarioDTO>;
  inativar(id: number): Resposta<void>;
  reativar(id: number): Resposta<void>;
  resetarSenha(payload: ResetarSenhaPayload): Resposta<void>;
}

export interface IElectronAPI {
  auth: AuthAPI;
  usuarios: UsuariosAPI;
  ping: () => string;
  getVersions: () => {
    node: string;
    chrome: string;
    electron: string;
  };
  clientes: ClientesAPI;
  servicos: ServicosAPI;
  profissionais: ProfissionaisAPI;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
