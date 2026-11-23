/**
 * Aplica o tema salvo (escuro ou claro) ANTES de a página ser desenhada,
 * para a tela não "piscar" no tema errado. Carregado no <head> do shell e do login.
 * Script sem import/export: roda como script comum, sem módulos.
 */
(() => {
  let tema = 'dark';
  try {
    if (window.localStorage.getItem('ink-glow:tema') === 'light') tema = 'light';
  } catch {
    // Sem acesso ao armazenamento local: fica o tema escuro padrão.
  }
  document.documentElement.setAttribute('data-theme', tema);
})();
