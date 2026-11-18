import type { CanalAuth } from '../../shared/dtos';
import { HandlerProtegido, Permissao } from '../core/security';
import { IpcEntrada } from './IpcEntrada';
import { IpcEntradaAuth } from './IpcEntradaAuth';
import { IpcRegistrar } from './IpcRegistrar';
import { SegurancaContainer } from './SegurancaContainer';

/** Canais `usuarios:*` — todos exigem USUARIOS_GERENCIAR (somente ADMIN). */
export class UsuarioIpcHandler {
  constructor(
    private readonly seguranca: SegurancaContainer,
    private readonly ipc: IpcRegistrar,
  ) {}

  public registrar(): void {
    const { guard } = this.seguranca;
    const service = () => this.seguranca.usuarios;
    const admin = <T>(canal: CanalAuth, fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, guard.exigir(Permissao.USUARIOS_GERENCIAR, fn));

    admin('usuarios:listar', (p) => service().listar(IpcEntradaAuth.filtroUsuarios(p)));
    admin('usuarios:obter', (p) => service().obter(IpcEntrada.id(p)));
    admin('usuarios:salvar', (p, ator) => {
      const { id, dados } = IpcEntrada.salvar(p);
      const input = IpcEntradaAuth.usuario(dados);
      return id === undefined ? service().criar(input) : service().atualizar(id, input, ator.id);
    });
    admin('usuarios:inativar', (p, ator) => service().inativar(IpcEntrada.id(p), ator.id));
    admin('usuarios:reativar', (p) => service().reativar(IpcEntrada.id(p)));
    admin('usuarios:resetarSenha', (p) => {
      const { id, novaSenha } = IpcEntradaAuth.resetarSenha(p);
      return service().resetarSenha(id, novaSenha);
    });
  }
}
