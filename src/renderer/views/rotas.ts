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
  { id: 'inicio', rotulo: 'Painel', icone: '🏠', grupo: 'Atendimento', descricao: 'Resumo do dia: próximos atendimentos, estoque baixo e números do estúdio.', permissoes: [], criar: (s) => new DashboardView(s) },
  { id: 'agenda', rotulo: 'Agenda', icone: '📅', grupo: 'Atendimento', descricao: 'Clique num horário vago para agendar, ou num atendimento para confirmar, concluir ou cancelar.', permissoes: ['AGENDA_VER_TODOS', 'AGENDA_VER_PROPRIA'], criar: (s) => new AgendaView(s) },
  { id: 'historico', rotulo: 'Histórico', icone: '🧾', grupo: 'Atendimento', descricao: 'Atendimentos concluídos no período escolhido, com o valor cobrado de cada um.', permissoes: ['HISTORICO_VER_TODOS', 'HISTORICO_VER_PROPRIOS_CLIENTES'], criar: (s) => new HistoricoView(s) },
  { id: 'clientes', rotulo: 'Clientes', icone: '👤', grupo: 'Cadastros', descricao: 'Cadastre e encontre clientes. Ao digitar o CEP, o endereço é preenchido sozinho.', permissoes: ['CLIENTES_VER'], criar: (s) => new ClientesView(s) },
  { id: 'profissionais', rotulo: 'Profissionais', icone: '🎨', grupo: 'Cadastros', descricao: 'Equipe do estúdio e os procedimentos que cada profissional realiza.', permissoes: ['PROFISSIONAIS_VER'], criar: (s) => new ProfissionaisView(s) },
  { id: 'servicos', rotulo: 'Serviços', icone: '💉', grupo: 'Cadastros', descricao: 'Procedimentos oferecidos pelo estúdio, com duração e preço.', permissoes: ['SERVICOS_VER'], criar: (s) => new ServicosView(s) },
  { id: 'estoque', rotulo: 'Estoque', icone: '📦', grupo: 'Gestão', descricao: 'Materiais com custo em dólar e em real. Linhas em vermelho estão abaixo do mínimo.', permissoes: ['ESTOQUE_VER'], criar: (s) => new EstoqueView(s) },
  { id: 'lembretes', rotulo: 'Lembretes', icone: '✉️', grupo: 'Gestão', descricao: 'E-mails enviados aos clientes um dia antes do atendimento.', permissoes: ['LEMBRETES_GERENCIAR', 'AGENDA_EDITAR'], criar: (s) => new LembretesView(s) },
  { id: 'usuarios', rotulo: 'Usuários', icone: '🔐', grupo: 'Gestão', descricao: 'Quem acessa o sistema e com qual perfil. Senhas são guardadas só como hash.', permissoes: ['USUARIOS_GERENCIAR'], criar: (s) => new UsuariosView(s) },
];
