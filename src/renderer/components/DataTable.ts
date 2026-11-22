import { Filho, h, limpar } from '../core/dom.js';

export interface Coluna<T> {
  titulo: string;
  valor: (item: T) => Filho | Filho[];
  alinhar?: 'direita';
  largura?: string;
}

export interface PaginaDados<T> {
  items: T[];
  total: number;
}

export interface OpcoesDataTable<T> {
  colunas: Array<Coluna<T>>;
  /** Busca os dados (termo digitado, tamanho e deslocamento da página). */
  carregar: (termo: string, limit: number, offset: number) => Promise<PaginaDados<T>>;
  busca?: { placeholder: string; rotulo?: string } | false;
  porPagina?: number;
  /** Elementos extras na barra (filtros, botões). */
  filtros?: HTMLElement[];
  acoes?: HTMLElement[];
  vazio?: string;
  classeLinha?: (item: T) => string | undefined;
}

/**
 * Tabela com busca (com atraso para não consultar a cada tecla), paginação,
 * e estados de carregando, vazio e erro (com "tentar novamente").
 */
export class DataTable<T> {
  public readonly elemento: HTMLElement;
  private readonly corpo: HTMLElement;
  private readonly rodape: HTMLElement;
  private readonly campoBusca: HTMLInputElement | null;
  private pagina = 0;
  private atraso: number | undefined;
  private requisicao = 0;

  constructor(private readonly o: OpcoesDataTable<T>) {
    this.campoBusca = o.busca === false ? null : h('input', {
      type: 'search', class: 'entrada', placeholder: o.busca?.placeholder ?? 'Buscar…',
      'aria-label': o.busca?.rotulo ?? 'Buscar', 'data-busca': 'true',
    });
    this.campoBusca?.addEventListener('input', () => {
      window.clearTimeout(this.atraso);
      this.atraso = window.setTimeout(() => { this.pagina = 0; void this.recarregar(); }, 300);
    });

    this.corpo = h('div', { class: 'dt__moldura', 'aria-live': 'polite' });
    this.rodape = h('div', { class: 'dt__rodape' });
    this.elemento = h('section', { class: 'dt' },
      h('div', { class: 'dt__barra' },
        this.campoBusca ? h('div', { class: 'dt__busca' }, this.campoBusca) : null,
        ...(o.filtros ?? []),
        h('span', { class: 'espaco' }),
        ...(o.acoes ?? [])),
      this.corpo, this.rodape);
  }

  private get porPagina(): number {
    return this.o.porPagina ?? 20;
  }

  /** Recarrega a página atual (use após salvar/excluir). */
  public async recarregar(): Promise<void> {
    const minha = ++this.requisicao;
    this.mostrarEstado(h('span', { class: 'carregando-inline', 'aria-hidden': 'true' }), ' Carregando…');
    try {
      const dados = await this.o.carregar(this.campoBusca?.value.trim() ?? '', this.porPagina, this.pagina * this.porPagina);
      if (minha !== this.requisicao) return; // resposta antiga de uma busca já substituída
      if (dados.items.length === 0 && this.pagina > 0) {
        this.pagina = 0;
        await this.recarregar();
        return;
      }
      this.renderizar(dados);
    } catch (e) {
      if (minha !== this.requisicao) return;
      this.mostrarEstado(
        h('strong', {}, 'Não foi possível carregar.'), (e as Error).message, h('br'),
        h('button', { type: 'button', class: 'btn btn--sec btn--mini', onclick: () => void this.recarregar() }, 'Tentar novamente'));
      limpar(this.rodape);
    }
  }

  public irParaPrimeiraPagina(): void {
    this.pagina = 0;
    void this.recarregar();
  }

  private renderizar(dados: PaginaDados<T>): void {
    limpar(this.corpo);
    if (dados.items.length === 0) {
      this.mostrarEstado(h('strong', {}, 'Nada por aqui.'), this.o.vazio ?? 'Nenhum registro encontrado.');
    } else {
      this.corpo.append(h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, ...this.o.colunas.map((c) =>
          h('th', { scope: 'col', class: c.alinhar === 'direita' ? 'num' : undefined, style: c.largura ? `width:${c.largura}` : undefined }, c.titulo)))),
        h('tbody', {}, ...dados.items.map((item) =>
          h('tr', { class: this.o.classeLinha?.(item) }, ...this.o.colunas.map((c) => {
            const v = c.valor(item);
            return h('td', { class: c.alinhar === 'direita' ? 'num' : undefined }, ...(Array.isArray(v) ? v : [v]));
          }))))));
    }
    const inicio = dados.total === 0 ? 0 : this.pagina * this.porPagina + 1;
    const fim = Math.min(dados.total, (this.pagina + 1) * this.porPagina);
    const ultima = Math.max(0, Math.ceil(dados.total / this.porPagina) - 1);
    limpar(this.rodape);
    this.rodape.append(
      h('span', {}, dados.total === 0 ? '' : `${inicio}–${fim} de ${dados.total}`),
      h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'btn btn--sec btn--mini', disabled: this.pagina === 0, 'aria-label': 'Página anterior', onclick: () => { this.pagina--; void this.recarregar(); } }, '‹ Anterior'),
        h('button', { type: 'button', class: 'btn btn--sec btn--mini', disabled: this.pagina >= ultima, 'aria-label': 'Próxima página', onclick: () => { this.pagina++; void this.recarregar(); } }, 'Próxima ›')));
  }

  private mostrarEstado(...conteudo: Filho[]): void {
    limpar(this.corpo);
    this.corpo.append(h('div', { class: 'dt__estado' }, ...conteudo));
  }
}
