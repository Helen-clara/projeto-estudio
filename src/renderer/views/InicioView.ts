import { h, limpar } from '../core/dom.js';
import { View } from './View.js';

/** Tela inicial provisória (substituída pelo Dashboard). */
export class InicioView extends View {
  public async render(alvo: HTMLElement): Promise<void> {
    limpar(alvo);
    alvo.append(h('div', { class: 'cartao' },
      h('h3', {}, `Olá, ${this.sessao.primeiroNome}!`),
      h('p', { class: 'dica' }, 'Use o menu ao lado para navegar.')));
  }
}
