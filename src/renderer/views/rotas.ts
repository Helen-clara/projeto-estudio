import { RotaView } from './View.js';
import { DashboardView } from './DashboardView.js';
import { AgendaView } from './AgendaView.js';
import { ClientesView } from './ClientesView.js';
import { EstoqueView } from './EstoqueView.js';
import { HistoricoView } from './HistoricoView.js';
import { LembretesView } from './LembretesView.js';
import { ProfissionaisView } from './ProfissionaisView.js';
import { ServicosView } from './ServicosView.js';
import { UsuariosView } from './UsuariosView.js';

/**
 * Telas do sistema na ordem do menu. Cada uma declara quais permissões
 * (ver src/main/core/security/Permissao.ts) a tornam visível.
 */
export const ROTAS: RotaView[] = [
  { id: 'inicio', rotulo: 'Painel', icone: '🏠', grupo: 'Atendimento', permissoes: [], criar: (s) => new DashboardView(s) },
  { id: 'agenda', rotulo: 'Agenda', icone: '📅', grupo: 'Atendimento', permissoes: ['AGENDA_VER_TODOS', 'AGENDA_VER_PROPRIA'], criar: (s) => new AgendaView(s) },
  { id: 'historico', rotulo: 'Histórico', icone: '🧾', grupo: 'Atendimento', permissoes: ['HISTORICO_VER_TODOS', 'HISTORICO_VER_PROPRIOS_CLIENTES'], criar: (s) => new HistoricoView(s) },
  { id: 'clientes', rotulo: 'Clientes', icone: '👤', grupo: 'Cadastros', permissoes: ['CLIENTES_VER'], criar: (s) => new ClientesView(s) },
  { id: 'profissionais', rotulo: 'Profissionais', icone: '🎨', grupo: 'Cadastros', permissoes: ['PROFISSIONAIS_VER'], criar: (s) => new ProfissionaisView(s) },
  { id: 'servicos', rotulo: 'Serviços', icone: '💉', grupo: 'Cadastros', permissoes: ['SERVICOS_VER'], criar: (s) => new ServicosView(s) },
  { id: 'estoque', rotulo: 'Estoque', icone: '📦', grupo: 'Gestão', permissoes: ['ESTOQUE_VER'], criar: (s) => new EstoqueView(s) },
  { id: 'lembretes', rotulo: 'Lembretes', icone: '✉️', grupo: 'Gestão', permissoes: ['LEMBRETES_GERENCIAR', 'AGENDA_EDITAR'], criar: (s) => new LembretesView(s) },
  { id: 'usuarios', rotulo: 'Usuários', icone: '🔐', grupo: 'Gestão', permissoes: ['USUARIOS_GERENCIAR'], criar: (s) => new UsuariosView(s) },
];
