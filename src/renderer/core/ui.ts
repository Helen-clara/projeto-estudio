import { Toast } from '../components/Toast.js';
import { Filho, h } from './dom.js';
import { ROTULOS_STATUS } from './formato.js';

/** Etiqueta colorida de status (agendamento, lembrete...). */
export function tagStatus(status: string, texto?: string): HTMLElement {
  return h('span', { class: `tag tag--${status}` }, texto ?? ROTULOS_STATUS[status] ?? status);
}

export function tag(texto: string, tipo: 'neutra' | 'ok' | 'erro' | 'aviso' | 'vinho' = 'neutra', semPonto = true): HTMLElement {
  return h('span', { class: `tag tag--${tipo}${semPonto ? ' tag--sem-ponto' : ''}` }, texto);
}

/**
 * Botão que executa uma ação assíncrona: fica desabilitado enquanto roda e
 * mostra o erro do backend num toast.
 */
export function botao(texto: Filho, acao: () => Promise<void> | void, classe = 'btn btn--sec btn--mini', rotulo?: string): HTMLButtonElement {
  const b = h('button', { type: 'button', class: classe, 'aria-label': rotulo }, texto);
  b.addEventListener('click', () => {
    b.disabled = true;
    Promise.resolve()
      .then(acao)
      .catch((e: Error) => Toast.erro(e.message))
      .finally(() => { b.disabled = false; });
  });
  return b;
}

export function kpi(rotulo: string, valor: string, nota: string, vinho = false): HTMLElement {
  return h('div', { class: `kpi${vinho ? ' kpi--vinho' : ''}` },
    h('span', { class: 'kpi__rotulo' }, rotulo), h('strong', { class: 'kpi__valor' }, valor), h('span', { class: 'kpi__nota' }, nota));
}

export function cartao(titulo: string, conteudo: Filho | Filho[], acoes?: HTMLElement): HTMLElement {
  return h('section', { class: 'cartao' },
    h('div', { class: 'cartao__titulo' }, h('h3', {}, titulo), acoes ?? null),
    ...(Array.isArray(conteudo) ? conteudo : [conteudo]));
}

/** Seletor simples (filtros de barra). */
export function seletor(rotulo: string, opcoes: Array<[string, string]>, valor = '', aoMudar?: (v: string) => void): HTMLSelectElement {
  const s = h('select', { class: 'entrada', 'aria-label': rotulo }, ...opcoes.map(([v, t]) => h('option', { value: v }, t)));
  s.value = valor;
  if (aoMudar) s.addEventListener('change', () => aoMudar(s.value));
  return s;
}
