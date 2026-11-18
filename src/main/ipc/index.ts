import { CadastrosContainer } from './CadastrosContainer';
import { ClienteIpcHandler } from './ClienteIpcHandler';
import { IpcRegistrar } from './IpcRegistrar';
import { ProfissionalIpcHandler } from './ProfissionalIpcHandler';
import { ServicoIpcHandler } from './ServicoIpcHandler';

export { IpcRegistrar } from './IpcRegistrar';
export { IpcEntrada } from './IpcEntrada';
export { CadastrosContainer } from './CadastrosContainer';

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
