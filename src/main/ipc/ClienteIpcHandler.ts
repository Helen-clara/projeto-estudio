import type { CanalCadastro } from '../../shared/dtos';
import { HandlerProtegido, IpcGuard, Permissao } from '../core/security';
import { CadastrosContainer } from './CadastrosContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcRegistrar } from './IpcRegistrar';

/** Canais `clientes:*`. Ver: CLIENTES_VER; alterar: CLIENTES_EDITAR. */
export class ClienteIpcHandler {
  constructor(
    private readonly container: CadastrosContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalCadastro, permissao: Permissao, fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigir(permissao, fn));
    const service = () => this.container.clientes;
    const { CLIENTES_VER: VER, CLIENTES_EDITAR: EDITAR } = Permissao;

    handle('clientes:listar', VER, (p) => service().listar(IpcEntrada.filtroListagem(p)));
    handle('clientes:obter', VER, (p) => service().obter(IpcEntrada.id(p)));
    handle('clientes:salvar', EDITAR, (p) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntrada.cliente(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input);
    });
    handle('clientes:inativar', EDITAR, (p) => service().inativar(IpcEntrada.id(p)));
    handle('clientes:reativar', EDITAR, (p) => service().reativar(IpcEntrada.id(p)));
    handle('clientes:buscarCep', EDITAR, (p) => service().buscarEnderecoPorCep(IpcEntrada.texto(p, 'cep', 9)));
  }
}
