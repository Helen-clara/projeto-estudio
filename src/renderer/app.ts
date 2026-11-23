import { Api, ErroApi, EVENTO_SESSAO_EXPIRADA } from './core/Api.js';
import { h, limpar, porId } from './core/dom.js';
import { Formato, ROTULOS_ESPECIALIDADE, ROTULOS_PERFIL } from './core/formato.js';
import { Sessao } from './core/Sessao.js';
import { FormField, Formulario } from './components/FormField.js';
import { Modal } from './components/Modal.js';
import { Sidebar } from './components/Sidebar.js';
import { Toast } from './components/Toast.js';
import { ROTAS } from './views/rotas.js';
import { View } from './views/View.js';

/** Página de login (tela do Prompt 4), relativa a dist/renderer/index.html. */
const TELA_LOGIN = './login/login.html';

/**
 * Shell principal: confere a sessão, monta o menu conforme o perfil, troca de tela
 * pelo endereço (#/rota) e cuida dos atalhos de teclado.
 */
class App {
  private sessao!: Sessao;
  private sidebar!: Sidebar;
  private viewAtual: View | null = null;
  private readonly conteudo = porId<HTMLElement>('conteudo');

  public async iniciar(): Promise<void> {
    let usuario;
    try {
      usuario = await Api.chamar(window.api.auth.usuarioAtual());
    } catch {
      usuario = null;
    }
    if (!usuario) {
      this.irParaLogin();
      return;
    }
    this.sessao = new Sessao(usuario);
    this.montarShell();
    window.addEventListener('hashchange', () => this.navegar(this.rotaDoEndereco()));
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, () => {
      Toast.aviso('Sua sessão expirou. Entre novamente.');
      setTimeout(() => this.irParaLogin(), 1200);
    });
    document.addEventListener('keydown', (e) => this.atalhos(e));
    this.navegar(this.rotaDoEndereco());
  }

  private montarShell(): void {
    this.sidebar = new Sidebar(ROTAS, (id) => { window.location.hash = `#/${id}`; });
    porId('slot-menu').replaceWith(this.sidebar.elemento);
    this.sidebar.montar(this.sessao);

    const u = this.sessao.usuario;
    porId('usuario-avatar').textContent = Formato.iniciais(u.nome);
    porId('usuario-nome').textContent = u.nome;
    porId('usuario-perfil').textContent = `${ROTULOS_PERFIL[u.perfil] ?? u.perfil}${u.especialidade ? ` · ${ROTULOS_ESPECIALIDADE[u.especialidade]}` : ''}`;
    porId('btn-senha').addEventListener('click', () => this.trocarSenha());
    porId('btn-sair').addEventListener('click', () => void this.sair());
    porId('app').hidden = false;
  }

  private rotaDoEndereco(): string {
    return window.location.hash.replace(/^#\/?/, '') || 'inicio';
  }

  private navegar(id: string): void {
    const rotasVisiveis = ROTAS.filter((r) => r.permissoes.length === 0 || this.sessao.pode(...r.permissoes));
    const rota = rotasVisiveis.find((r) => r.id === id) ?? rotasVisiveis[0];
    if (rota.id !== id) {
      window.location.replace(`#/${rota.id}`);
      return;
    }
    Modal.fecharTodos();
    this.sidebar.marcarAtivo(rota.id);
    porId('titulo-tela').textContent = rota.rotulo;
    porId('subtitulo-tela').textContent = this.subtitulo();
    document.title = `${rota.rotulo} — Ink & Glow Studio`;

    this.viewAtual = rota.criar(this.sessao);
    limpar(this.conteudo);
    this.conteudo.append(h('div', { class: 'vazio' }, h('span', { class: 'carregando-inline', 'aria-hidden': 'true' }), ' Carregando…'));
    const view = this.viewAtual;
    view.render(this.conteudo).catch((e: Error) => {
      if (view !== this.viewAtual) return;
      limpar(this.conteudo);
      this.conteudo.append(h('div', { class: 'alerta alerta--erro', role: 'alert' }, e instanceof ErroApi ? e.message : `Erro ao abrir a tela: ${e.message}`));
    });
    this.conteudo.focus({ preventScroll: true });
  }

  private subtitulo(): string {
    const hoje = new Date();
    const dia = Formato.diaSemana(hoje);
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  }

  /** Alt+1…9: navegar · "/": focar busca · Ctrl+N: novo item da tela atual. Esc é tratado pelo Modal. */
  private atalhos(e: KeyboardEvent): void {
    const digitando = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const rota = this.sidebar.rotaNaPosicao(Number(e.key) - 1);
      if (rota) { e.preventDefault(); window.location.hash = `#/${rota.id}`; }
      return;
    }
    if (Modal.algumAberto) return;
    if (e.key === '/' && !digitando) {
      const busca = this.conteudo.querySelector<HTMLInputElement>('[data-busca]');
      if (busca) { e.preventDefault(); busca.focus(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && this.viewAtual?.novo) {
      e.preventDefault();
      this.viewAtual.novo();
    }
  }

  private trocarSenha(): void {
    const f = new Formulario({
      atual: new FormField({ rotulo: 'Senha atual', tipo: 'senha', obrigatorio: true, largura: 6, autocomplete: 'current-password' }),
      nova: new FormField({ rotulo: 'Nova senha', tipo: 'senha', obrigatorio: true, largura: 3, autocomplete: 'new-password', ajuda: 'Mínimo 8 caracteres, com letras e números.' }),
      repetir: new FormField({ rotulo: 'Repita a nova senha', tipo: 'senha', obrigatorio: true, largura: 3, autocomplete: 'new-password' }),
    });
    Modal.abrir({
      titulo: 'Trocar minha senha', tamanho: 'estreito', conteudo: f.elemento,
      botoes: [{ texto: 'Salvar nova senha', aoClicar: async (m) => {
        if (!f.validar()) return;
        if (f.campos.nova.valor !== f.campos.repetir.valor) { f.campos.repetir.definirErro('As senhas não conferem.'); return; }
        await Api.chamar(window.api.auth.trocarSenha({ senhaAtual: f.campos.atual.valor, novaSenha: f.campos.nova.valor }));
        m.fechar();
        Toast.sucesso('Senha alterada.');
      } }],
    });
  }

  private async sair(): Promise<void> {
    if (!(await Modal.confirmar('Sair do sistema', 'Deseja encerrar a sua sessão?', 'Sair'))) return;
    await window.api.auth.logout().catch(() => undefined);
    this.irParaLogin();
  }

  private irParaLogin(): void {
    window.location.href = TELA_LOGIN;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  void new App().iniciar();
});
