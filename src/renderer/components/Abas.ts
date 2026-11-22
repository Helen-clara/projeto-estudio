import { h, limpar } from '../core/dom.js';

export interface Aba {
  rotulo: string;
  /** Monta o conteúdo quando a aba é aberta pela primeira vez. */
  conteudo: () => HTMLElement | Promise<HTMLElement>;
}

/** Abas acessíveis (role="tablist"), com conteúdo carregado sob demanda. */
export class Abas {
  public readonly elemento: HTMLElement;
  private readonly painel: HTMLElement;
  private readonly botoes: HTMLButtonElement[];
  private readonly cache = new Map<number, HTMLElement>();

  constructor(private readonly abas: Aba[]) {
    this.painel = h('div', { role: 'tabpanel' });
    this.botoes = abas.map((a, i) => h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => void this.abrir(i) }, a.rotulo));
    this.elemento = h('div', {}, h('div', { class: 'abas', role: 'tablist' }, ...this.botoes), this.painel);
    void this.abrir(0);
  }

  public async abrir(indice: number): Promise<void> {
    this.botoes.forEach((b, i) => b.setAttribute('aria-selected', String(i === indice)));
    limpar(this.painel);
    let conteudo = this.cache.get(indice);
    if (!conteudo) {
      this.painel.append(h('div', { class: 'vazio' }, 'Carregando…'));
      try {
        conteudo = await this.abas[indice].conteudo();
      } catch (e) {
        conteudo = h('div', { class: 'alerta alerta--erro' }, (e as Error).message);
      }
      this.cache.set(indice, conteudo);
      limpar(this.painel);
    }
    this.painel.append(conteudo);
  }
}
