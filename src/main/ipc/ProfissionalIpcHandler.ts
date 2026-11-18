import type { CanalCadastro } from '../../shared/dtos';
import { HandlerProtegido, IpcGuard, Permissao } from '../core/security';
import { CadastrosContainer } from './CadastrosContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcRegistrar } from './IpcRegistrar';

/**
 * Canais `profissionais:*` (inclui o vínculo N:N com serviços).
 * Ver: PROFISSIONAIS_VER; alterar: PROFISSIONAIS_GERENCIAR (ADMIN).
 */
export class ProfissionalIpcHandler {
  constructor(
    private readonly container: CadastrosContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalCadastro, permissao: Permissao, fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigir(permissao, fn));
    const service = () => this.container.profissionais;
    const { PROFISSIONAIS_VER: VER, PROFISSIONAIS_GERENCIAR: GERENCIAR } = Permissao;

    handle('profissionais:listar', VER, (p) => service().listar(IpcEntrada.filtroProfissionais(p)));
    handle('profissionais:obter', VER, (p) => service().obter(IpcEntrada.id(p)));
    handle('profissionais:salvar', GERENCIAR, (p) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntrada.profissional(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input);
    });
    handle('profissionais:inativar', GERENCIAR, (p) => service().inativar(IpcEntrada.id(p)));
    handle('profissionais:reativar', GERENCIAR, (p) => service().reativar(IpcEntrada.id(p)));
    handle('profissionais:listarServicos', VER, (p) => service().listarServicos(IpcEntrada.id(p, 'profissionalId')));
    handle('profissionais:vincularServico', GERENCIAR, (p) => {
      const { profissionalId, servicoId } = IpcEntrada.vinculo(p);
      return service().vincularServico(profissionalId, servicoId);
    });
    handle('profissionais:desvincularServico', GERENCIAR, (p) => {
      const { profissionalId, servicoId } = IpcEntrada.vinculo(p);
      return service().desvincularServico(profissionalId, servicoId);
    });
    handle('profissionais:definirServicos', GERENCIAR, (p) => {
      const o = IpcEntrada.objeto(p, 'payload');
      return service().definirServicos(
        IpcEntrada.id(o.profissionalId, 'profissionalId'),
        IpcEntrada.ids(o.servicoIds, 'servicoIds'),
      );
    });
  }
}
