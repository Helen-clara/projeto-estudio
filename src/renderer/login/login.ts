/// <reference path="../../preload/index.d.ts" />

/**
 * Tela de login. Fala com o main somente por `window.api.auth` (preload).
 *
 * Ponto de navegação: após o login, vai para TelaLogin.SHELL_PRINCIPAL.
 * A integração com o layout principal (menu por permissões etc.) é feita no Prompt 8.
 */
class TelaLogin {
  /** Shell principal, relativo a dist/renderer/login/login.html. */
  public static readonly SHELL_PRINCIPAL = '../index.html';

  private readonly form = TelaLogin.elemento<HTMLFormElement>('form-login');
  private readonly campoLogin = TelaLogin.elemento<HTMLInputElement>('campo-login');
  private readonly campoSenha = TelaLogin.elemento<HTMLInputElement>('campo-senha');
  private readonly botaoOlho = TelaLogin.elemento<HTMLButtonElement>('btn-mostrar-senha');
  private readonly botaoEntrar = TelaLogin.elemento<HTMLButtonElement>('btn-entrar');
  private readonly erro = TelaLogin.elemento<HTMLParagraphElement>('mensagem-erro');

  public iniciar(): void {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.entrar();
    });
    this.botaoOlho.addEventListener('click', () => this.alternarSenha());
    [this.campoLogin, this.campoSenha].forEach((c) => c.addEventListener('input', () => this.limparErro()));
    void this.redirecionarSeJaLogado();
  }

  private async entrar(): Promise<void> {
    const login = this.campoLogin.value.trim();
    const senha = this.campoSenha.value;

    if (!login || !senha) {
      this.mostrarErro('Informe usuário e senha.');
      (login ? this.campoSenha : this.campoLogin).focus();
      return;
    }

    this.carregando(true);
    try {
      const resposta = await window.api.auth.login({ login, senha });
      if (resposta.ok && resposta.data) {
        this.irParaShell();
        return;
      }
      this.mostrarErro(resposta.error ?? 'Usuário ou senha inválidos.');
      this.campoSenha.value = '';
      this.campoSenha.focus();
    } catch {
      this.mostrarErro('Não foi possível entrar agora. Tente novamente.');
    } finally {
      this.carregando(false);
    }
  }

  private async redirecionarSeJaLogado(): Promise<void> {
    try {
      const atual = await window.api.auth.usuarioAtual();
      if (atual.ok && atual.data) this.irParaShell();
    } catch {
      // Sem sessão: permanece na tela de login.
    }
  }

  private irParaShell(): void {
    window.location.href = TelaLogin.SHELL_PRINCIPAL;
  }

  private alternarSenha(): void {
    const mostrar = this.campoSenha.type === 'password';
    this.campoSenha.type = mostrar ? 'text' : 'password';
    this.botaoOlho.setAttribute('aria-pressed', String(mostrar));
    const rotulo = mostrar ? 'Ocultar senha' : 'Mostrar senha';
    this.botaoOlho.setAttribute('aria-label', rotulo);
    this.botaoOlho.title = rotulo;
    this.campoSenha.focus();
  }

  private mostrarErro(mensagem: string): void {
    this.erro.textContent = mensagem;
    this.erro.hidden = false;
    this.campoLogin.setAttribute('aria-invalid', 'true');
    this.campoSenha.setAttribute('aria-invalid', 'true');
  }

  private limparErro(): void {
    this.erro.hidden = true;
    this.erro.textContent = '';
    this.campoLogin.removeAttribute('aria-invalid');
    this.campoSenha.removeAttribute('aria-invalid');
  }

  private carregando(ativo: boolean): void {
    this.botaoEntrar.disabled = ativo;
    this.botaoEntrar.textContent = ativo ? 'Entrando…' : 'Entrar';
    this.campoLogin.disabled = ativo;
    this.campoSenha.disabled = ativo;
  }

  private static elemento<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento #${id} não encontrado na tela de login.`);
    return el as T;
  }
}

/**
 * Botão de tema da tela de login (só aparência): troca data-theme do <html>
 * e guarda a escolha com a mesma chave usada pelo app (core/Tema.ts).
 */
class AlternadorTemaLogin {
  private static readonly CHAVE = 'ink-glow:tema';

  public static iniciar(): void {
    const botao = document.getElementById('btn-tema');
    if (!botao) return;
    const atualizar = (): void => {
      const escuro = document.documentElement.getAttribute('data-theme') !== 'light';
      botao.textContent = escuro ? '☀ Tema claro' : '☾ Tema escuro';
      botao.setAttribute('aria-label', escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
    };
    botao.addEventListener('click', () => {
      const novo = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', novo);
      try {
        window.localStorage.setItem(AlternadorTemaLogin.CHAVE, novo);
      } catch {
        // Sem armazenamento local: vale só até fechar o app.
      }
      atualizar();
    });
    atualizar();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  AlternadorTemaLogin.iniciar();
  new TelaLogin().iniciar();
});
