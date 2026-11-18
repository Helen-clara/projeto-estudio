import type { CanalCadastro } from '../../shared/dtos';
import { CadastrosContainer } from './CadastrosContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcRegistrar } from './IpcRegistrar';

/** Canais `clientes:*`. */
export class ClienteIpcHandler {
  constructor(
    private readonly container: CadastrosContainer,
    private readonly ipc: IpcRegistrar,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalCadastro, fn: (payload: unknown) => Promise<T>) => this.ipc.handle(canal, fn);
    const service = () => this.container.clientes;

    handle('clientes:listar', (p) => service().listar(IpcEntrada.filtroListagem(p)));
    handle('clientes:obter', (p) => service().obter(IpcEntrada.id(p)));
    handle('clientes:salvar', (p) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntrada.cliente(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input);
    });
    handle('clientes:inativar', (p) => service().inativar(IpcEntrada.id(p)));
    handle('clientes:reativar', (p) => service().reativar(IpcEntrada.id(p)));
    handle('clientes:buscarCep', (p) => service().buscarEnderecoPorCep(IpcEntrada.texto(p, 'cep', 9)));
  }
}
