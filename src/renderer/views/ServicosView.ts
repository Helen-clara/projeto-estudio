import type { CategoriaValor, ServicoDTO } from '../../shared/dtos';
import { DataTable } from '../components/DataTable.js';
import { FormField, Formulario } from '../components/FormField.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato, ROTULOS_CATEGORIA } from '../core/formato.js';
import { botao, seletor, tag } from '../core/ui.js';
import { View } from './View.js';

/** Catálogo de procedimentos (somente o ADMIN altera). */
export class ServicosView extends View {
  private tabela!: DataTable<ServicoDTO>;
  private categoria = '';
  private situacao = 'true';

  private get podeEditar(): boolean {
    return this.sessao.pode('SERVICOS_EDITAR');
  }

  public async render(alvo: HTMLElement): Promise<void> {
    this.tabela = new DataTable<ServicoDTO>({
      busca: { placeholder: 'Nome do serviço…' },
      filtros: [
        seletor('Categoria', [['', 'Todas as categorias'], ['TATUAGEM', 'Tatuagem'], ['ESTETICA', 'Estética']], this.categoria, (v) => { this.categoria = v; this.tabela.irParaPrimeiraPagina(); }),
        seletor('Situação', [['true', 'Ativos'], ['false', 'Inativos']], this.situacao, (v) => { this.situacao = v; this.tabela.irParaPrimeiraPagina(); }),
      ],
      acoes: this.podeEditar ? [h('button', { type: 'button', class: 'btn', onclick: () => this.novo() }, '+ Novo serviço')] : [h('span', { class: 'dica' }, 'Somente o administrador altera o catálogo.')],
      classeLinha: (s) => (s.ativo ? undefined : 'linha--inativa'),
      carregar: (termo, limit, offset) => Api.chamar(window.api.servicos.listar({
        termo: termo || undefined, categoria: (this.categoria || undefined) as CategoriaValor | undefined, ativo: this.situacao === 'true', limit, offset,
      })),
      colunas: [
        { titulo: 'Serviço', valor: (s) => [h('strong', {}, s.nome), s.descricao ? h('span', { class: 'secundario' }, s.descricao) : null] },
        { titulo: 'Categoria', valor: (s) => tag(ROTULOS_CATEGORIA[s.categoria], s.categoria === 'TATUAGEM' ? 'vinho' : 'neutra') },
        { titulo: 'Duração', valor: (s) => `${s.duracaoMinutos} min`, alinhar: 'direita' },
        { titulo: 'Preço', valor: (s) => Formato.moeda(s.preco), alinhar: 'direita' },
        { titulo: 'Ações', largura: '190px', valor: (s) => (this.podeEditar ? h('div', { class: 'acoes' },
          s.ativo ? botao('Editar', () => this.abrir(s)) : null,
          s.ativo ? botao('Inativar', () => this.inativar(s), 'btn btn--perigo btn--mini')
            : botao('Reativar', async () => { await Api.chamar(window.api.servicos.reativar(s.id)); Toast.sucesso('Serviço reativado.'); await this.tabela.recarregar(); })) : '—') },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' }, this.tabela.elemento));
    await this.tabela.recarregar();
  }

  public novo(): void {
    if (this.podeEditar) this.abrir(null);
  }

  private async inativar(s: ServicoDTO): Promise<void> {
    if (!(await Modal.confirmar('Inativar serviço', `Inativar "${s.nome}"? Ele deixa de aparecer para novos agendamentos.`, 'Inativar', true))) return;
    await Api.chamar(window.api.servicos.inativar(s.id));
    Toast.sucesso('Serviço inativado.');
    await this.tabela.recarregar();
  }

  private abrir(s: ServicoDTO | null): void {
    const f = new Formulario({
      nome: new FormField({ rotulo: 'Nome', obrigatorio: true, largura: 4, valor: s?.nome, maxLength: 120 }),
      categoria: new FormField({ rotulo: 'Categoria', tipo: 'select', obrigatorio: true, largura: 2, opcoes: [['TATUAGEM', 'Tatuagem'], ['ESTETICA', 'Estética']], valor: s?.categoria ?? 'TATUAGEM' }),
      duracao: new FormField({ rotulo: 'Duração (minutos)', tipo: 'numero', obrigatorio: true, largura: 3, min: 1, max: 720, passo: 5, valor: s?.duracaoMinutos ?? 60 }),
      preco: new FormField({ rotulo: 'Preço (R$)', tipo: 'numero', obrigatorio: true, largura: 3, min: 0, passo: '0.01', valor: s?.preco ?? '' }),
      descricao: new FormField({ rotulo: 'Descrição', tipo: 'textarea', largura: 6, valor: s?.descricao, maxLength: 500 }),
    });
    Modal.abrir({
      titulo: s ? `Editar serviço` : 'Novo serviço',
      conteudo: f.elemento,
      botoes: [{ texto: 'Salvar', aoClicar: async (m) => {
        if (!f.validar()) return;
        const c = f.campos;
        await Api.chamar(window.api.servicos.salvar({ id: s?.id, dados: {
          nome: c.nome.valor, categoria: c.categoria.valor as CategoriaValor, duracaoMinutos: c.duracao.numero, preco: c.preco.numero, descricao: c.descricao.valorOuNulo,
        } }));
        m.fechar();
        Toast.sucesso('Serviço salvo.');
        await this.tabela.recarregar();
      } }],
    });
  }
}
