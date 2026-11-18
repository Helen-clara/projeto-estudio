import type { CanalCadastro } from '../../shared/dtos';
import { CadastrosContainer } from './CadastrosContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcRegistrar } from './IpcRegistrar';

/** Canais `servicos:*`. */
export class ServicoIpcHandler {
  constructor(
    private readonly container: CadastrosContainer,
    private readonly ipc: IpcRegistrar,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalCadastro, fn: (payload: unknown) => Promise<T>) => this.ipc.handle(canal, fn);
    const service = () => this.container.servicos;

    handle('servicos:listar', (p) => service().listar(IpcEntrada.filtroServicos(p)));
    handle('servicos:obter', (p) => service().obter(IpcEntrada.id(p)));
    handle('servicos:salvar', (p) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntrada.servico(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input);
    });
    handle('servicos:inativar', (p) => service().inativar(IpcEntrada.id(p)));
    handle('servicos:reativar', (p) => service().reativar(IpcEntrada.id(p)));
  }
}
