import { AuthIpcHandler } from './AuthIpcHandler';
import { CadastrosContainer } from './CadastrosContainer';
import { ClienteIpcHandler } from './ClienteIpcHandler';
import { IpcRegistrar } from './IpcRegistrar';
import { ProfissionalIpcHandler } from './ProfissionalIpcHandler';
import { SegurancaContainer } from './SegurancaContainer';
import { ServicoIpcHandler } from './ServicoIpcHandler';
import { UsuarioIpcHandler } from './UsuarioIpcHandler';

export { IpcRegistrar } from './IpcRegistrar';
export { IpcEntrada } from './IpcEntrada';
export { CadastrosContainer } from './CadastrosContainer';
export { SegurancaContainer } from './SegurancaContainer';

/**
 * Registra todos os canais IPC. Chamar uma vez, após app.whenReady().
 * Todos os canais, exceto auth:login/logout/usuarioAtual, passam pelo IpcGuard
 * (sessão + permissão) antes de executar.
 */
export function registrarHandlers(
  seguranca: SegurancaContainer = new SegurancaContainer(),
  cadastros: CadastrosContainer = new CadastrosContainer(),
  ipc: IpcRegistrar = new IpcRegistrar(),
): IpcRegistrar {
  const { guard } = seguranca;
  new AuthIpcHandler(seguranca, ipc).registrar();
  new UsuarioIpcHandler(seguranca, ipc).registrar();
  new ClienteIpcHandler(cadastros, ipc, guard).registrar();
  new ServicoIpcHandler(cadastros, ipc, guard).registrar();
  new ProfissionalIpcHandler(cadastros, ipc, guard).registrar();
  return ipc;
}
