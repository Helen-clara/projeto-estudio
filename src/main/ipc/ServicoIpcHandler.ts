import type { CanalCadastro } from '../../shared/dtos';
import { HandlerProtegido, IpcGuard, Permissao } from '../core/security';
import { CadastrosContainer } from './CadastrosContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcRegistrar } from './IpcRegistrar';

/** Canais `servicos:*`. Ver: SERVICOS_VER; alterar: SERVICOS_EDITAR (ADMIN). */
export class ServicoIpcHandler {
  constructor(
    private readonly container: CadastrosContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalCadastro, permissao: Permissao, fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigir(permissao, fn));
    const service = () => this.container.servicos;
    const { SERVICOS_VER: VER, SERVICOS_EDITAR: EDITAR } = Permissao;

    handle('servicos:listar', VER, (p) => service().listar(IpcEntrada.filtroServicos(p)));
    handle('servicos:obter', VER, (p) => service().obter(IpcEntrada.id(p)));
    handle('servicos:salvar', EDITAR, (p) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntrada.servico(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input);
    });
    handle('servicos:inativar', EDITAR, (p) => service().inativar(IpcEntrada.id(p)));
    handle('servicos:reativar', EDITAR, (p) => service().reativar(IpcEntrada.id(p)));
  }
}
