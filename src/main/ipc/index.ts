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

/** Registra os canais IPC de clientes, serviços e profissionais. Chamar uma vez, após app.whenReady(). */
export function registrarHandlersCadastros(
  container: CadastrosContainer = new CadastrosContainer(),
  ipc: IpcRegistrar = new IpcRegistrar(),
): IpcRegistrar {
  new ClienteIpcHandler(container, ipc).registrar();
  new ServicoIpcHandler(container, ipc).registrar();
  new ProfissionalIpcHandler(container, ipc).registrar();
  return ipc;
}

/** Registra os canais `auth:*` e `usuarios:*`. */
export function registrarHandlersAuth(
  seguranca: SegurancaContainer = new SegurancaContainer(),
  ipc: IpcRegistrar = new IpcRegistrar(),
): IpcRegistrar {
  new AuthIpcHandler(seguranca, ipc).registrar();
  new UsuarioIpcHandler(seguranca, ipc).registrar();
  return ipc;
}
