import { h } from '../core/dom.js';

export type TipoToast = 'ok' | 'erro' | 'aviso';

/** Mensagens rápidas de sucesso/erro no canto da tela (anunciadas a leitores de tela). */
export class Toast {
  private static container: HTMLElement | null = null;

  public static sucesso(mensagem: string): void { Toast.mostrar(mensagem, 'ok'); }
  public static erro(mensagem: string): void { Toast.mostrar(mensagem, 'erro'); }
  public static aviso(mensagem: string): void { Toast.mostrar(mensagem, 'aviso'); }

  public static mostrar(mensagem: string, tipo: TipoToast = 'ok'): void {
    const caixa = Toast.obterContainer();
    const fechar = (): void => item.remove();
    const item = h('div', { class: `toast toast--${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' },
      h('span', {}, mensagem),
      h('button', { type: 'button', 'aria-label': 'Fechar aviso', onclick: fechar }, '×'));
    caixa.append(item);
    setTimeout(fechar, tipo === 'erro' ? 7000 : 4500);
  }

  private static obterContainer(): HTMLElement {
    if (!Toast.container || !Toast.container.isConnected) {
      Toast.container = h('div', { class: 'toasts', 'aria-live': 'polite' });
      document.body.append(Toast.container);
    }
    return Toast.container;
  }
}
