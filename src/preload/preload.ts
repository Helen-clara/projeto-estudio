import { contextBridge, ipcRenderer } from 'electron';
// Somente tipos: o preload roda em sandbox e não pode importar módulos locais em tempo de execução.
import type { ApiResult, CanalAuth, CanalCadastro } from '../shared/dtos';
import type { CanalAgenda } from '../shared/agenda';
import type { IElectronAPI } from './index';

/** Invoca um canal IPC conhecido (os tipos de canal impedem nomes errados). */
const invocar = <T>(canal: CanalCadastro | CanalAuth | CanalAgenda, payload?: unknown): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(canal, payload) as Promise<ApiResult<T>>;

const api: IElectronAPI = {
  agenda: {
    listar: (filtro) => invocar('agenda:listar', filtro),
    obter: (id) => invocar('agenda:obter', id),
    criar: (dados) => invocar('agenda:criar', dados),
    editar: (payload) => invocar('agenda:editar', payload),
    confirmar: (id) => invocar('agenda:confirmar', id),
    cancelar: (payload) => invocar('agenda:cancelar', payload),
    concluir: (payload) => invocar('agenda:concluir', payload),
    marcarFalta: (id) => invocar('agenda:marcarFalta', id),
    excluir: (id) => invocar('agenda:excluir', id),
    verificarFeriado: (data) => invocar('agenda:verificarFeriado', data),
  },

  historico: {
    porCliente: (payload) => invocar('historico:porCliente', payload),
    porProfissional: (payload) => invocar('historico:porProfissional', payload),
    porPeriodo: (payload) => invocar('historico:porPeriodo', payload),
  },

  estatisticas: {
    resumo: (periodo) => invocar('estatisticas:resumo', periodo),
  },

  auth: {
    login: (payload) => invocar('auth:login', payload),
    logout: () => invocar('auth:logout'),
    usuarioAtual: () => invocar('auth:usuarioAtual'),
    trocarSenha: (payload) => invocar('auth:trocarSenha', payload),
  },

  usuarios: {
    listar: (filtro) => invocar('usuarios:listar', filtro),
    obter: (id) => invocar('usuarios:obter', id),
    salvar: (payload) => invocar('usuarios:salvar', payload),
    inativar: (id) => invocar('usuarios:inativar', id),
    reativar: (id) => invocar('usuarios:reativar', id),
    resetarSenha: (payload) => invocar('usuarios:resetarSenha', payload),
  },

  ping: (): string => 'pong',
  getVersions: () => ({
    node: process.versions.node || '',
    chrome: process.versions.chrome || '',
    electron: process.versions.electron || ''
  }),

  clientes: {
    listar: (filtro) => invocar('clientes:listar', filtro),
    obter: (id) => invocar('clientes:obter', id),
    salvar: (payload) => invocar('clientes:salvar', payload),
    inativar: (id) => invocar('clientes:inativar', id),
    reativar: (id) => invocar('clientes:reativar', id),
    buscarCep: (cep) => invocar('clientes:buscarCep', cep),
  },

  servicos: {
    listar: (filtro) => invocar('servicos:listar', filtro),
    obter: (id) => invocar('servicos:obter', id),
    salvar: (payload) => invocar('servicos:salvar', payload),
    inativar: (id) => invocar('servicos:inativar', id),
    reativar: (id) => invocar('servicos:reativar', id),
  },

  profissionais: {
    listar: (filtro) => invocar('profissionais:listar', filtro),
    obter: (id) => invocar('profissionais:obter', id),
    salvar: (payload) => invocar('profissionais:salvar', payload),
    inativar: (id) => invocar('profissionais:inativar', id),
    reativar: (id) => invocar('profissionais:reativar', id),
    listarServicos: (profissionalId) => invocar('profissionais:listarServicos', profissionalId),
    vincularServico: (payload) => invocar('profissionais:vincularServico', payload),
    desvincularServico: (payload) => invocar('profissionais:desvincularServico', payload),
    definirServicos: (payload) => invocar('profissionais:definirServicos', payload),
  },
};

contextBridge.exposeInMainWorld('api', api);
