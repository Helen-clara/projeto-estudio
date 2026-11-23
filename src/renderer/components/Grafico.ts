import { h, svg } from '../core/dom.js';

export interface PontoGrafico {
  rotulo: string;
  valor: number;
}

const formatarPadrao = (v: number): string => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function defs(): SVGDefsElement {
  return svg('defs', {},
    svg('linearGradient', { id: 'gradiente-ouro', x1: '0', x2: '1', y1: '0', y2: '0' },
      svg('stop', { offset: '0%', 'stop-color': '#9b3050' }),
      svg('stop', { offset: '100%', 'stop-color': '#d4a24c' })));
}

/** Gráfico de barras horizontais em SVG (sem bibliotecas). */
export class GraficoBarras {
  public static criar(dados: PontoGrafico[], formatar: (v: number) => string = formatarPadrao, titulo = 'Gráfico de barras'): HTMLElement | SVGSVGElement {
    if (dados.length === 0) return h('div', { class: 'vazio' }, 'Sem dados no período.');
    const altLinha = 34;
    const largura = 520;
    const rotulo = 150;
    const valorLarg = 90;
    const area = largura - rotulo - valorLarg - 10;
    const max = Math.max(...dados.map((d) => d.valor), 1);
    const g = svg('svg', { class: 'grafico', viewBox: `0 0 ${largura} ${dados.length * altLinha}`, role: 'img', 'aria-label': titulo }, defs());
    dados.forEach((d, i) => {
      const y = i * altLinha;
      const w = Math.max(3, (d.valor / max) * area);
      const nome = d.rotulo.length > 22 ? `${d.rotulo.slice(0, 21)}…` : d.rotulo;
      g.append(
        svg('text', { x: 0, y: y + 21 }, nome),
        svg('rect', { x: rotulo, y: y + 9, width: area, height: 14, rx: 7, fill: 'var(--fundo)' }),
        svg('rect', { class: 'barra', x: rotulo, y: y + 9, width: w, height: 14, rx: 7 }, svg('title', {}, `${d.rotulo}: ${formatar(d.valor)}`)),
        svg('text', { x: largura, y: y + 21, 'text-anchor': 'end' }, formatar(d.valor)),
      );
    });
    return g;
  }
}

/** Gráfico de linha com área em SVG (ex.: faturamento por mês). */
export class GraficoLinha {
  public static criar(dados: PontoGrafico[], formatar: (v: number) => string = formatarPadrao, titulo = 'Gráfico de linha'): HTMLElement | SVGSVGElement {
    if (dados.length === 0) return h('div', { class: 'vazio' }, 'Sem dados no período.');
    const L = 520;
    const A = 200;
    const m = { esq: 28, dir: 28, topo: 24, base: 26 };
    const max = Math.max(...dados.map((d) => d.valor), 1);
    const passo = dados.length > 1 ? (L - m.esq - m.dir) / (dados.length - 1) : 0;
    const pts = dados.map((d, i) => ({
      x: dados.length > 1 ? m.esq + i * passo : L / 2,
      y: m.topo + (A - m.topo - m.base) * (1 - d.valor / max),
      d,
    }));
    const g = svg('svg', { class: 'grafico', viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': titulo }, defs());
    for (let i = 0; i <= 3; i++) {
      const y = m.topo + ((A - m.topo - m.base) / 3) * i;
      g.append(svg('line', { class: 'grade-linha', x1: m.esq, x2: L - m.dir, y1: y, y2: y }));
    }
    const caminho = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    if (pts.length > 1) {
      g.append(svg('path', { class: 'area', d: `${caminho} L${pts[pts.length - 1].x},${A - m.base} L${pts[0].x},${A - m.base} Z` }));
    }
    g.append(svg('path', { class: 'linha', d: caminho }));
    pts.forEach((p, i) => {
      g.append(
        svg('circle', { class: 'ponto', cx: p.x, cy: p.y, r: 4 }, svg('title', {}, `${p.d.rotulo}: ${formatar(p.d.valor)}`)),
        svg('text', { x: p.x, y: A - 8, 'text-anchor': 'middle' }, p.d.rotulo),
        svg('text', { x: p.x, y: p.y - 9, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle' }, formatar(p.d.valor)),
      );
    });
    return g;
  }
}
