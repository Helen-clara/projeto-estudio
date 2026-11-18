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
  PaginaDTO,
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

export interface IElectronAPI {
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
