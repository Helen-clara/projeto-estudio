import type { CanalCadastro } from '../../shared/dtos';
import { CadastrosContainer } from './CadastrosContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcRegistrar } from './IpcRegistrar';

/** Canais `profissionais:*` (inclui o vínculo N:N com serviços). */
export class ProfissionalIpcHandler {
  constructor(
    private readonly container: CadastrosContainer,
    private readonly ipc: IpcRegistrar,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalCadastro, fn: (payload: unknown) => Promise<T>) => this.ipc.handle(canal, fn);
    const service = () => this.container.profissionais;

    handle('profissionais:listar', (p) => service().listar(IpcEntrada.filtroProfissionais(p)));
    handle('profissionais:obter', (p) => service().obter(IpcEntrada.id(p)));
    handle('profissionais:salvar', (p) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntrada.profissional(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input);
    });
    handle('profissionais:inativar', (p) => service().inativar(IpcEntrada.id(p)));
    handle('profissionais:reativar', (p) => service().reativar(IpcEntrada.id(p)));
    handle('profissionais:listarServicos', (p) => service().listarServicos(IpcEntrada.id(p, 'profissionalId')));
    handle('profissionais:vincularServico', (p) => {
      const { profissionalId, servicoId } = IpcEntrada.vinculo(p);
      return service().vincularServico(profissionalId, servicoId);
    });
    handle('profissionais:desvincularServico', (p) => {
      const { profissionalId, servicoId } = IpcEntrada.vinculo(p);
      return service().desvincularServico(profissionalId, servicoId);
    });
    handle('profissionais:definirServicos', (p) => {
      const o = IpcEntrada.objeto(p, 'payload');
      return service().definirServicos(
        IpcEntrada.id(o.profissionalId, 'profissionalId'),
        IpcEntrada.ids(o.servicoIds, 'servicoIds'),
      );
    });
  }
}
