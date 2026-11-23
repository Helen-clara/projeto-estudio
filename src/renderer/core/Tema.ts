import { h } from './dom.js';

export type ModoTema = 'dark' | 'light';

/**
 * Alternância entre modo escuro (padrão) e modo claro. É só aparência:
 * troca o atributo data-theme do <html> (as cores vêm de variáveis CSS)
 * e lembra a escolha no localStorage deste computador.
 */
export class Tema {
  public static readonly CHAVE = 'ink-glow:tema';

  public static get atual(): ModoTema {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  public static definir(modo: ModoTema): void {
    document.documentElement.setAttribute('data-theme', modo);
    try {
      window.localStorage.setItem(Tema.CHAVE, modo);
    } catch {
      // Sem armazenamento local: o tema vale só até fechar o app.
    }
  }

  public static alternar(): ModoTema {
    const novo: ModoTema = Tema.atual === 'dark' ? 'light' : 'dark';
    Tema.definir(novo);
    return novo;
  }

  /** Botão do topo: mostra para qual tema vai trocar. */
  public static criarBotao(): HTMLButtonElement {
    const botao = h('button', { type: 'button', class: 'btn btn--fantasma btn--mini' });
    const atualizar = (): void => {
      const escuro = Tema.atual === 'dark';
      botao.textContent = escuro ? '☀ Tema claro' : '☾ Tema escuro';
      botao.title = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
      botao.setAttribute('aria-label', botao.title);
    };
    botao.addEventListener('click', () => { Tema.alternar(); atualizar(); });
    atualizar();
    return botao;
  }
}
