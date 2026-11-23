import { Filho, h, limpar } from '../core/dom.js';

export interface BotaoModal {
  texto: string;
  /** Classe extra do botão (ex.: 'btn--perigo'). Padrão: botão principal dourado. */
  classe?: string;
  /** Pode lançar erro: a mensagem aparece no topo do modal e ele continua aberto. */
  aoClicar: (modal: Modal) => Promise<void> | void;
}

export interface OpcoesModal {
  titulo: string;
  conteudo: Filho | Filho[];
  botoes?: BotaoModal[];
  tamanho?: 'estreito' | 'normal' | 'largo';
  /** Texto do botão de fechar (padrão: "Cancelar" quando há ações, "Fechar" sem ações). */
  textoFechar?: string;
  aoFechar?: () => void;
}

/**
 * Janela modal acessível: foco inicial no primeiro campo, Tab preso dentro do modal,
 * Esc fecha e o foco volta para o elemento que abriu.
 */
export class Modal {
  private static readonly abertos: Modal[] = [];
  private readonly fundo: HTMLElement;
  private readonly caixaErro: HTMLElement;
  private readonly corpo: HTMLElement;
  private readonly focoAnterior: Element | null;

  constructor(private readonly opcoes: OpcoesModal) {
    this.focoAnterior = document.activeElement;
    const idTitulo = `modal-titulo-${Date.now()}`;
    this.caixaErro = h('div', { class: 'alerta alerta--erro', role: 'alert', hidden: true });
    this.corpo = h('div', { class: 'modal__corpo' }, this.caixaErro);
    this.definirConteudo(opcoes.conteudo);

    const botoes = (opcoes.botoes ?? []).map((b) => this.criarBotao(b));
    this.fundo = h('div', { class: 'modal-fundo', onmousedown: ((e: Event) => { if (e.target === this.fundo) this.fechar(); }) as EventListener },
      h('div', { class: `modal${opcoes.tamanho && opcoes.tamanho !== 'normal' ? ` modal--${opcoes.tamanho}` : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo },
        h('header', { class: 'modal__topo' },
          h('h2', { id: idTitulo }, opcoes.titulo),
          h('button', { type: 'button', class: 'btn btn--fantasma btn--icone', 'aria-label': 'Fechar', onclick: () => this.fechar() }, '✕')),
        this.corpo,
        h('footer', { class: 'modal__rodape' },
          h('button', { type: 'button', class: 'btn btn--sec', onclick: () => this.fechar() },
            opcoes.textoFechar ?? (botoes.length ? 'Cancelar' : 'Fechar')),
          ...botoes)));
    this.fundo.addEventListener('keydown', (e) => this.teclado(e));
  }

  /** Atalho: cria e abre. */
  public static abrir(opcoes: OpcoesModal): Modal {
    return new Modal(opcoes).abrir();
  }

  /** Confirmação de ação (ex.: cancelar, inativar). Resolve true se confirmada. */
  public static confirmar(titulo: string, mensagem: string, textoConfirmar = 'Confirmar', perigo = false): Promise<boolean> {
    return new Promise((resolver) => {
      let confirmado = false;
      Modal.abrir({
        titulo,
        tamanho: 'estreito',
        conteudo: h('p', {}, mensagem),
        aoFechar: () => resolver(confirmado),
        botoes: [{ texto: textoConfirmar, classe: perigo ? 'btn--vinho' : undefined, aoClicar: (m) => { confirmado = true; m.fechar(); } }],
      });
    });
  }

  public static fecharTodos(): void {
    [...Modal.abertos].forEach((m) => m.fechar());
  }

  public static get algumAberto(): boolean {
    return Modal.abertos.length > 0;
  }

  public abrir(): this {
    document.body.append(this.fundo);
    Modal.abertos.push(this);
    const primeiro = this.corpo.querySelector<HTMLElement>('input:not([type=hidden]):not(:disabled), select, textarea')
      ?? this.fundo.querySelector<HTMLElement>('.modal__rodape .btn:last-child');
    primeiro?.focus();
    return this;
  }

  public fechar(): void {
    if (!this.fundo.isConnected) return;
    this.fundo.remove();
    Modal.abertos.splice(Modal.abertos.indexOf(this), 1);
    this.opcoes.aoFechar?.();
    if (this.focoAnterior instanceof HTMLElement && this.focoAnterior.isConnected) this.focoAnterior.focus();
  }

  public erro(mensagem: string): void {
    this.caixaErro.textContent = mensagem;
    this.caixaErro.hidden = false;
    this.caixaErro.scrollIntoView({ block: 'nearest' });
  }

  public limparErro(): void {
    this.caixaErro.hidden = true;
  }

  /** Troca o conteúdo do corpo (mantém a caixa de erro). */
  public definirConteudo(conteudo: Filho | Filho[]): void {
    limpar(this.corpo);
    this.corpo.append(this.caixaErro);
    for (const item of Array.isArray(conteudo) ? conteudo : [conteudo]) {
      if (item === null || item === undefined || item === false) continue;
      this.corpo.append(item instanceof Node ? item : document.createTextNode(String(item)));
    }
  }

  private criarBotao(b: BotaoModal): HTMLButtonElement {
    const btn = h('button', { type: 'button', class: `btn ${b.classe ?? ''}` }, b.texto);
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      this.limparErro();
      Promise.resolve()
        .then(() => b.aoClicar(this))
        .catch((e: Error) => this.erro(e.message))
        .finally(() => { btn.disabled = false; btn.removeAttribute('aria-busy'); });
    });
    return btn;
  }

  private teclado(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.fechar();
      return;
    }
    if (e.key !== 'Tab') return;
    const focaveis = Array.from(this.fundo.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }
}
