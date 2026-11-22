/**
 * Criação de elementos sem innerHTML: todo texto entra como nó de texto,
 * então dados vindos do banco nunca são interpretados como HTML (evita XSS).
 */
export type Filho = Node | string | number | null | undefined | false;
export type Atributos = Record<string, string | number | boolean | EventListener | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  atributos: Atributos = {},
  ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (nome.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(nome.slice(2), valor as EventListener);
    } else if (nome === 'class') {
      el.className = String(valor);
    } else if (valor === true) {
      el.setAttribute(nome, '');
    } else {
      el.setAttribute(nome, String(valor));
    }
  }
  anexar(el, filhos);
  return el;
}

export function anexar(el: Element, filhos: Filho[]): void {
  for (const f of filhos) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

export function limpar(el: Element): void {
  el.replaceChildren();
}

export function porId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado.`);
  return el as T;
}

/** Elemento SVG (gráficos). */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  atributos: Record<string, string | number> = {},
  ...filhos: Array<SVGElement | string>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, String(v));
  for (const f of filhos) el.append(typeof f === 'string' ? document.createTextNode(f) : f);
  return el;
}
