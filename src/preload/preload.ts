import { contextBridge, ipcRenderer } from 'electron';
// Somente tipos: o preload roda em sandbox e não pode importar módulos locais em tempo de execução.
import type { ApiResult, CanalCadastro } from '../shared/dtos';
import type { IElectronAPI } from './index';

/** Invoca um canal IPC conhecido (o tipo CanalCadastro impede nomes errados). */
const invocar = <T>(canal: CanalCadastro, payload?: unknown): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(canal, payload) as Promise<ApiResult<T>>;

const api: IElectronAPI = {
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
