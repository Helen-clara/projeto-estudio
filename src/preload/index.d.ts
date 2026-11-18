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
import type {
  AgendamentoDTO,
  AgendamentoInput,
  AgendamentoSalvoDTO,
  CancelarAgendamentoPayload,
  ConcluirAgendamentoPayload,
  EditarAgendamentoPayload,
  EstatisticasResumoDTO,
  FiltroAgenda,
  FiltroHistorico,
  HistoricoDTO,
  PeriodoPayload,
} from '../shared/agenda';
import type {
  FiltroLembretes,
  PaginaLembretesDTO,
  ResultadoLembreteDTO,
  ResumoProcessamentoDTO,
} from '../shared/lembretes';

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

/**
 * Agenda. ADMIN/RECEPCAO veem e alteram qualquer agenda; PROFISSIONAL só a própria
 * (o filtro de profissional é forçado no main). Concluir: ADMIN e o próprio profissional.
 */
export interface AgendaAPI {
  listar(filtro?: FiltroAgenda): Resposta<PaginaDTO<AgendamentoDTO>>;
  obter(id: number): Resposta<AgendamentoDTO>;
  /** Se cair em feriado, `requerConfirmacao = true`: reenvie com `confirmarFeriado: true`. */
  criar(dados: AgendamentoInput): Resposta<AgendamentoSalvoDTO>;
  editar(payload: EditarAgendamentoPayload): Resposta<AgendamentoSalvoDTO>;
  confirmar(id: number): Resposta<AgendamentoDTO>;
  cancelar(payload: CancelarAgendamentoPayload): Resposta<AgendamentoDTO>;
  /** Exige CONFIRMADO e horário já iniciado. Sem `valorCobrado`, usa o preço do serviço. */
  concluir(payload: ConcluirAgendamentoPayload): Resposta<AgendamentoDTO>;
  marcarFalta(id: number): Resposta<AgendamentoDTO>;
  /** Exclusão lógica; só para cancelados ou faltas. */
  excluir(id: number): Resposta<void>;
  /** data: 'AAAA-MM-DD'. `verificado: false` = sem conexão com a BrasilAPI. */
  verificarFeriado(data: string): Resposta<{ feriado: string | null; verificado: boolean }>;
}

export interface HistoricoAPI {
  porCliente(payload: FiltroHistorico & { clienteId: number }): Resposta<HistoricoDTO>;
  porProfissional(payload: FiltroHistorico & { profissionalId: number }): Resposta<HistoricoDTO>;
  porPeriodo(payload: FiltroHistorico & PeriodoPayload): Resposta<HistoricoDTO>;
}

export interface EstatisticasAPI {
  /** Somente ADMIN (RELATORIOS_VER). */
  resumo(periodo: PeriodoPayload): Resposta<EstatisticasResumoDTO>;
}

export interface LembretesAPI {
  /** ADMIN e RECEPCAO. */
  listar(filtro?: FiltroLembretes): Resposta<PaginaLembretesDTO>;
  /** Reenvio manual (ADMIN e RECEPCAO): zera tentativas e envia agora. */
  reenviar(lembreteId: number): Resposta<ResultadoLembreteDTO>;
  /** Somente ADMIN: exclusão lógica (para de enviar automaticamente). */
  excluir(lembreteId: number): Resposta<void>;
  /** Somente ADMIN: processa os lembretes de amanhã imediatamente (demonstração). */
  rodarAgora(): Resposta<ResumoProcessamentoDTO>;
}

export interface IElectronAPI {
  lembretes: LembretesAPI;
  agenda: AgendaAPI;
  historico: HistoricoAPI;
  estatisticas: EstatisticasAPI;
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
