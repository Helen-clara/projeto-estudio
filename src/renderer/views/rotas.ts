import { RotaView } from './View.js';
import { InicioView } from './InicioView.js';
import { AgendaView } from './AgendaView.js';
import { ClientesView } from './ClientesView.js';
import { ProfissionaisView } from './ProfissionaisView.js';
import { ServicosView } from './ServicosView.js';

/**
 * Telas do sistema na ordem do menu. Cada uma declara quais permissões
 * (ver src/main/core/security/Permissao.ts) a tornam visível.
 */
export const ROTAS: RotaView[] = [
  { id: 'inicio', rotulo: 'Início', icone: '🏠', grupo: 'Atendimento', permissoes: [], criar: (s) => new InicioView(s) },
  { id: 'agenda', rotulo: 'Agenda', icone: '📅', grupo: 'Atendimento', permissoes: ['AGENDA_VER_TODOS', 'AGENDA_VER_PROPRIA'], criar: (s) => new AgendaView(s) },
  { id: 'clientes', rotulo: 'Clientes', icone: '👤', grupo: 'Cadastros', permissoes: ['CLIENTES_VER'], criar: (s) => new ClientesView(s) },
  { id: 'profissionais', rotulo: 'Profissionais', icone: '🎨', grupo: 'Cadastros', permissoes: ['PROFISSIONAIS_VER'], criar: (s) => new ProfissionaisView(s) },
  { id: 'servicos', rotulo: 'Serviços', icone: '💉', grupo: 'Cadastros', permissoes: ['SERVICOS_VER'], criar: (s) => new ServicosView(s) },
];
