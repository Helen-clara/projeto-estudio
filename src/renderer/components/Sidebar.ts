import { h, limpar } from '../core/dom.js';
import { Sessao } from '../core/Sessao.js';
import { RotaView } from '../views/View.js';

/**
 * Menu lateral com as telas que o perfil logado pode ver.
 * Itens sem permissão nem aparecem (a checagem real continua no main).
 */
export class Sidebar {
  public readonly elemento: HTMLElement;
  private readonly nav: HTMLElement;
  private visiveis: RotaView[] = [];

  constructor(private readonly rotas: RotaView[], private readonly aoNavegar: (id: string) => void) {
    this.nav = h('nav', { 'aria-label': 'Menu principal' });
    this.elemento = h('aside', { class: 'menu' },
      h('div', { class: 'marca' },
        h('div', { class: 'marca__logo', 'aria-hidden': 'true' }, '✦'),
        h('div', {}, h('div', { class: 'marca__nome' }, 'Ink & Glow'), h('div', { class: 'marca__sub' }, 'Studio'))),
      this.nav,
      h('div', { class: 'menu__rodape' }, 'Atalhos: Alt+1…9 navega · / busca · Ctrl+N novo · Esc fecha'));
  }

  /** Monta os itens permitidos para a sessão. */
  public montar(sessao: Sessao): RotaView[] {
    this.visiveis = this.rotas.filter((r) => r.permissoes.length === 0 || sessao.pode(...r.permissoes));
    limpar(this.nav);
    let grupo = '';
    this.visiveis.forEach((r, i) => {
      if (r.grupo !== grupo) {
        grupo = r.grupo;
        this.nav.append(h('div', { class: 'menu__grupo' }, grupo));
      }
      this.nav.append(h('a', { class: 'menu__item', href: `#/${r.id}`, 'data-rota': r.id, onclick: ((e: Event) => { e.preventDefault(); this.aoNavegar(r.id); }) as EventListener },
        h('span', { class: 'menu__icone', 'aria-hidden': 'true' }, r.icone),
        h('span', { class: 'menu__texto' }, r.rotulo),
        i < 9 ? h('span', { class: 'menu__atalho', 'aria-hidden': 'true' }, `Alt+${i + 1}`) : null));
    });
    return this.visiveis;
  }

  public marcarAtivo(id: string): void {
    this.nav.querySelectorAll('[data-rota]').forEach((el) => {
      if (el.getAttribute('data-rota') === id) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  /** Rota pela posição (atalho Alt+N). */
  public rotaNaPosicao(n: number): RotaView | undefined {
    return this.visiveis[n];
  }
}
