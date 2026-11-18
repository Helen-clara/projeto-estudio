import { AgendaContainer } from './AgendaContainer';
import { AgendaIpcHandler } from './AgendaIpcHandler';
import { AuthIpcHandler } from './AuthIpcHandler';
import { HistoricoIpcHandler } from './HistoricoIpcHandler';
import { CadastrosContainer } from './CadastrosContainer';
import { ClienteIpcHandler } from './ClienteIpcHandler';
import { EstoqueContainer } from './EstoqueContainer';
import { EstoqueIpcHandler } from './EstoqueIpcHandler';
import { IpcRegistrar } from './IpcRegistrar';
import { LembreteIpcHandler } from './LembreteIpcHandler';
import { LembretesContainer } from './LembretesContainer';
import { ProfissionalIpcHandler } from './ProfissionalIpcHandler';
import { SegurancaContainer } from './SegurancaContainer';
import { ServicoIpcHandler } from './ServicoIpcHandler';
import { UsuarioIpcHandler } from './UsuarioIpcHandler';

export { IpcRegistrar } from './IpcRegistrar';
export { IpcEntrada } from './IpcEntrada';
export { CadastrosContainer } from './CadastrosContainer';
export { SegurancaContainer } from './SegurancaContainer';
export { AgendaContainer } from './AgendaContainer';
export { LembretesContainer } from './LembretesContainer';
export { EstoqueContainer } from './EstoqueContainer';

/**
 * Registra todos os canais IPC. Chamar uma vez, após app.whenReady().
 * Todos os canais, exceto auth:login/logout/usuarioAtual, passam pelo IpcGuard
 * (sessão + permissão) antes de executar.
 */
export interface ContainersApp {
  seguranca?: SegurancaContainer;
  cadastros?: CadastrosContainer;
  agenda?: AgendaContainer;
  lembretes?: LembretesContainer;
  estoque?: EstoqueContainer;
  ipc?: IpcRegistrar;
}

export function registrarHandlers(containers: ContainersApp = {}): IpcRegistrar {
  const seguranca = containers.seguranca ?? new SegurancaContainer();
  const cadastros = containers.cadastros ?? new CadastrosContainer();
  const agenda = containers.agenda ?? new AgendaContainer();
  const lembretes = containers.lembretes ?? new LembretesContainer();
  const estoque = containers.estoque ?? new EstoqueContainer();
  const ipc = containers.ipc ?? new IpcRegistrar();
  const { guard } = seguranca;
  new LembreteIpcHandler(lembretes, ipc, guard).registrar();
  new AuthIpcHandler(seguranca, ipc).registrar();
  new UsuarioIpcHandler(seguranca, ipc).registrar();
  new ClienteIpcHandler(cadastros, ipc, guard).registrar();
  new ServicoIpcHandler(cadastros, ipc, guard).registrar();
  new ProfissionalIpcHandler(cadastros, ipc, guard).registrar();
  new AgendaIpcHandler(agenda, ipc, guard).registrar();
  new HistoricoIpcHandler(agenda, ipc, guard).registrar();
  new EstoqueIpcHandler(estoque, ipc, guard).registrar();
  return ipc;
}
