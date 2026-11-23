import type { CategoriaValor } from '../../shared/dtos';
import type { CotacaoDTO, MaterialDTO, MoedaValor, TipoMovimentacaoValor } from '../../shared/estoque';
import { DataTable } from '../components/DataTable.js';
import { FormField, Formulario } from '../components/FormField.js';
import { GraficoBarras } from '../components/Grafico.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato, ROTULOS_CATEGORIA } from '../core/formato.js';
import { botao, cartao, kpi, seletor, tag } from '../core/ui.js';
import { View } from './View.js';

const ROTULO_TIPO: Record<TipoMovimentacaoValor, string> = { ENTRADA: 'Entrada', SAIDA: 'Saída', AJUSTE: 'Ajuste' };

/** Estoque de materiais com custo em USD/BRL (AwesomeAPI), movimentações e relatórios. */
export class EstoqueView extends View {
  private tabela!: DataTable<MaterialDTO>;
  private categoria = '';
  private apenasBaixo = false;
  private situacao = 'true';
  private cotacao: CotacaoDTO | null = null;
  private readonly topo = h('div', { class: 'pagina' });

  private get podeEditar(): boolean { return this.sessao.pode('ESTOQUE_EDITAR'); }
  private get podeMovimentar(): boolean { return this.sessao.pode('ESTOQUE_EDITAR', 'ESTOQUE_REGISTRAR_CONSUMO'); }

  public async render(alvo: HTMLElement): Promise<void> {
    const baixo = h('input', { type: 'checkbox' });
    baixo.addEventListener('change', () => { this.apenasBaixo = baixo.checked; this.tabela.irParaPrimeiraPagina(); });
    this.tabela = new DataTable<MaterialDTO>({
      busca: { placeholder: 'Material ou fornecedor…' },
      filtros: [
        seletor('Categoria', [['', 'Todas as categorias'], ['TATUAGEM', 'Tatuagem'], ['ESTETICA', 'Estética']], this.categoria, (v) => { this.categoria = v; this.tabela.irParaPrimeiraPagina(); }),
        this.podeEditar ? seletor('Situação', [['true', 'Ativos'], ['false', 'Inativos']], this.situacao, (v) => { this.situacao = v; this.tabela.irParaPrimeiraPagina(); }) : h('span'),
        h('label', { style: 'display:inline-flex;gap:6px;align-items:center;color:var(--suave);font-size:13px' }, baixo, 'Só estoque baixo'),
      ],
      acoes: [
        h('button', { type: 'button', class: 'btn btn--sec', 'data-acao': 'relatorio', onclick: () => void this.relatorio() }, '📊 Relatório'),
        this.podeEditar ? botao('↻ Recalcular preços em BRL', () => this.recalcular(), 'btn btn--sec') : h('span'),
        this.podeMovimentar ? h('button', { type: 'button', class: `btn ${this.podeEditar ? 'btn--sec' : ''}`, 'data-acao': 'movimentar', onclick: () => void this.movimentar(null) }, this.podeEditar ? '⇅ Movimentar' : '− Registrar consumo') : h('span'),
        this.podeEditar ? h('button', { type: 'button', class: 'btn', onclick: () => this.novo() }, '+ Novo material') : h('span'),
      ],
      vazio: 'Nenhum material encontrado.',
      classeLinha: (m) => (!m.ativo ? 'linha--inativa' : m.estoqueBaixo ? 'linha--alerta' : undefined),
      carregar: (termo, limit, offset) => Api.chamar(window.api.estoque.listar({
        termo: termo || undefined, categoria: (this.categoria || undefined) as CategoriaValor | undefined,
        apenasEstoqueBaixo: this.apenasBaixo || undefined, ativo: this.situacao === 'true', limit, offset,
      })),
      colunas: [
        { titulo: 'Material', valor: (m) => [h('strong', {}, m.nome), h('span', { class: 'secundario' }, `${ROTULOS_CATEGORIA[m.categoria]}${m.fornecedor ? ` · ${m.fornecedor}` : ''}`)] },
        { titulo: 'Saldo', alinhar: 'direita', valor: (m) => h('span', { class: 'nowrap' }, `${Formato.numero(m.quantidadeAtual)} ${m.unidade}`, m.estoqueBaixo ? h('span', {}, ' ', tag('baixo', 'erro')) : null) },
        { titulo: 'Mínimo', alinhar: 'direita', valor: (m) => Formato.numero(m.estoqueMinimo) },
        { titulo: 'Custo USD', alinhar: 'direita', valor: (m) => Formato.moeda(m.precoCustoUsd, 'USD') },
        { titulo: 'Custo BRL', alinhar: 'direita', valor: (m) => Formato.moeda(m.precoCustoBrl) },
        { titulo: 'Cotação usada', valor: (m) => (m.cotacaoUsada ? [h('span', { class: 'nowrap' }, `US$ 1 = ${Formato.moeda(m.cotacaoUsada).replace(/(\d),(\d{2})$/, '$1,$2')}`), h('span', { class: 'secundario' }, Formato.dataHora(m.cotacaoEm))] : h('span', { class: 'dica' }, 'preço em BRL')) },
        { titulo: 'Valor em estoque', alinhar: 'direita', valor: (m) => Formato.moeda(m.valorEstoqueBrl) },
        { titulo: 'Ações', valor: (m) => h('div', { class: 'acoes' },
          this.podeMovimentar && m.ativo ? botao(this.podeEditar ? 'Movimentar' : 'Consumo', () => this.movimentar(m)) : null,
          botao('🕘', () => this.historico(m), 'btn btn--sec btn--mini', `Histórico de movimentações de ${m.nome}`),
          this.podeEditar && m.ativo ? botao('✎', () => this.formulario(m), 'btn btn--sec btn--mini', `Editar ${m.nome}`) : null,
          this.podeEditar ? (m.ativo
            ? botao('⊘', async () => {
              if (!(await Modal.confirmar('Inativar material', `Inativar "${m.nome}"? O histórico de movimentações é mantido.`, 'Inativar', true))) return;
              await Api.chamar(window.api.estoque.inativar(m.id)); Toast.sucesso('Material inativado.'); await this.atualizar();
            }, 'btn btn--perigo btn--mini', `Inativar ${m.nome}`)
            : botao('Reativar', async () => { await Api.chamar(window.api.estoque.reativar(m.id)); Toast.sucesso('Material reativado.'); await this.atualizar(); })) : null) },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' }, this.topo, this.tabela.elemento));
    await this.atualizar();
  }

  public novo(): void {
    if (this.podeEditar) void this.formulario(null);
  }

  /** Recarrega cotação, alerta de estoque baixo e a tabela. */
  private async atualizar(): Promise<void> {
    const [cot, alertas] = await Promise.all([
      Api.chamar(window.api.estoque.cotacaoAtual()).catch(() => null),
      Api.chamar(window.api.estoque.alertas()).catch(() => []),
    ]);
    this.cotacao = cot;
    limpar(this.topo);
    this.topo.append(h('div', { class: 'kpis' },
      kpi('Cotação do dólar (AwesomeAPI)', cot ? `R$ ${cot.valor.toFixed(4).replace('.', ',')}` : 'indisponível',
        cot ? `${Formato.dataHora(cot.dataHora)} · ${cot.fonte === 'API' ? 'agora' : cot.fonte === 'CACHE' ? 'cache (15 min)' : `último valor salvo (${cot.fonte.toLowerCase()})`}` : 'sem conexão e sem cotação salva'),
      kpi('Itens com estoque baixo', String(alertas.length), alertas.length ? 'quantidade ≤ mínimo' : 'tudo em ordem', alertas.length > 0)));
    if (cot?.desatualizada) this.topo.append(h('div', { class: 'alerta alerta--aviso' }, cot.aviso ?? 'Cotação possivelmente desatualizada.'));
    if (alertas.length) {
      this.topo.append(h('div', { class: 'alerta alerta--erro', role: 'status' },
        `⚠ Estoque baixo: ${alertas.map((a) => `${a.nome} (${Formato.numero(a.quantidadeAtual)}/${Formato.numero(a.estoqueMinimo)} ${a.unidade})`).join(' · ')}`));
    }
    await this.tabela.recarregar();
  }

  private async recalcular(): Promise<void> {
    if (!(await Modal.confirmar('Recalcular preços', 'Atualizar o custo em BRL de todos os materiais com preço em dólar pela cotação atual?', 'Recalcular'))) return;
    const r = await Api.chamar(window.api.estoque.recalcularPrecos());
    Toast.sucesso(`${r.atualizados} material(is) recalculado(s) com US$ 1 = R$ ${r.cotacao.valor.toFixed(4).replace('.', ',')}.`);
    r.avisos.forEach((a) => Toast.aviso(a));
    await this.atualizar();
  }

  // ------------------------------------------------------------- cadastro

  private async formulario(m: MaterialDTO | null): Promise<void> {
    const moedaInicial: MoedaValor = m && m.precoCustoUsd !== null && m.cotacaoUsada !== null ? 'USD' : 'BRL';
    const c = {
      nome: new FormField({ rotulo: 'Nome', obrigatorio: true, largura: 4, valor: m?.nome, maxLength: 120 }),
      categoria: new FormField({ rotulo: 'Categoria', tipo: 'select', obrigatorio: true, largura: 2, opcoes: [['TATUAGEM', 'Tatuagem'], ['ESTETICA', 'Estética']], valor: m?.categoria ?? 'TATUAGEM' }),
      unidade: new FormField({ rotulo: 'Unidade', obrigatorio: true, largura: 2, valor: m?.unidade ?? 'unidade', placeholder: 'frasco, caixa…', maxLength: 20 }),
      minimo: new FormField({ rotulo: 'Estoque mínimo', tipo: 'numero', obrigatorio: true, largura: 2, min: 0, passo: '0.01', valor: m?.estoqueMinimo ?? 0 }),
      inicial: new FormField({ rotulo: 'Quantidade inicial', tipo: 'numero', largura: 2, min: 0, passo: '0.01', valor: 0, desabilitado: m !== null, ajuda: m ? 'O saldo muda só por movimentação.' : undefined }),
      moeda: new FormField({ rotulo: 'Preço de custo em', tipo: 'select', largura: 2, opcoes: [['USD', 'Dólar (USD)'], ['BRL', 'Real (BRL)']], valor: moedaInicial }),
      preco: new FormField({ rotulo: 'Preço de custo', tipo: 'numero', largura: 2, min: 0, passo: '0.01', valor: m ? (moedaInicial === 'USD' ? m.precoCustoUsd : m.precoCustoBrl) : '' }),
      fornecedor: new FormField({ rotulo: 'Fornecedor', largura: 2, valor: m?.fornecedor, maxLength: 120 }),
    };
    const conversao = (): void => {
      const v = c.preco.numero;
      const cot = this.cotacao?.valor;
      if (!Number.isFinite(v) || !cot) { c.preco.definirAjuda(cot ? null : 'Sem cotação: informe em BRL.'); return; }
      c.preco.definirAjuda(c.moeda.valor === 'USD' ? `≈ ${Formato.moeda(v * cot)} pela cotação de hoje` : `≈ ${Formato.moeda(v / cot, 'USD')} pela cotação de hoje`);
    };
    c.preco.aoDigitar(conversao);
    c.moeda.aoMudar(conversao);
    conversao();
    const f = new Formulario(c);
    Modal.abrir({
      titulo: m ? `Editar ${m.nome}` : 'Novo material', tamanho: 'largo', conteudo: f.elemento,
      botoes: [{ texto: 'Salvar', aoClicar: async (modal) => {
        if (!f.validar()) return;
        const temPreco = c.preco.valor !== '';
        const r = await Api.chamar(window.api.estoque.salvar({ id: m?.id, dados: {
          nome: c.nome.valor, categoria: c.categoria.valor as CategoriaValor, unidade: c.unidade.valor, estoqueMinimo: c.minimo.numero,
          fornecedor: c.fornecedor.valorOuNulo,
          precoCusto: temPreco ? { moeda: c.moeda.valor as MoedaValor, valor: c.preco.numero } : null,
          quantidadeInicial: m ? undefined : (c.inicial.valor ? c.inicial.numero : 0),
        } }));
        modal.fechar();
        Toast.sucesso('Material salvo.');
        r.avisos.forEach((a) => Toast.aviso(a));
        await this.atualizar();
      } }],
    });
  }

  // ------------------------------------------------------------- movimentações

  private async movimentar(m: MaterialDTO | null): Promise<void> {
    const consumoProprio = !this.podeEditar;
    const materiais = (await Api.chamar(window.api.estoque.listar({ limit: 500 }))).items;
    const hoje = new Date();
    const agendamentos = (await Api.chamar(window.api.agenda.listar({
      dataInicio: Formato.isoData(Formato.somarDias(hoje, -7)), dataFim: Formato.isoData(Formato.somarDias(hoje, 1)),
      status: ['AGENDADO', 'CONFIRMADO', 'CONCLUIDO'], limit: 200,
    })).catch(() => ({ items: [] }))).items;

    const c = {
      material: new FormField({ rotulo: 'Material', tipo: 'select', obrigatorio: true, largura: 4,
        opcoes: [['', 'Selecione…'], ...materiais.map((x): [string, string] => [String(x.id), `${x.nome} — saldo ${Formato.numero(x.quantidadeAtual)} ${x.unidade}`])], valor: m ? String(m.id) : '' }),
      tipo: new FormField({ rotulo: 'Tipo', tipo: 'select', obrigatorio: true, largura: 2,
        opcoes: consumoProprio ? [['SAIDA', 'Saída (consumo)']] : [['ENTRADA', 'Entrada'], ['SAIDA', 'Saída'], ['AJUSTE', 'Ajuste de inventário']], valor: consumoProprio ? 'SAIDA' : 'ENTRADA' }),
      quantidade: new FormField({ rotulo: 'Quantidade', tipo: 'numero', obrigatorio: true, largura: 2, min: 0, passo: '0.01' }),
      agendamento: new FormField({ rotulo: consumoProprio ? 'Atendimento (obrigatório)' : 'Atendimento (opcional, só saída)', tipo: 'select', obrigatorio: consumoProprio, largura: 4,
        opcoes: [['', consumoProprio ? 'Selecione o atendimento…' : 'Sem atendimento'], ...agendamentos.map((a): [string, string] => [String(a.id), `${Formato.dataHora(a.inicio)} · ${a.clienteNome} · ${a.servicoNome}`])] }),
      motivo: new FormField({ rotulo: 'Motivo', largura: 6, maxLength: 240, placeholder: 'Ex.: compra NF 123, uso na sessão, contagem mensal…' }),
    };
    const ajustarRotulos = (): void => {
      const ajuste = c.tipo.valor === 'AJUSTE';
      const mat = materiais.find((x) => String(x.id) === c.material.valor);
      c.quantidade.definirAjuda(ajuste ? `Informe o NOVO saldo contado${mat ? ` (atual: ${Formato.numero(mat.quantidadeAtual)})` : ''}.` : mat ? `Saldo atual: ${Formato.numero(mat.quantidadeAtual)} ${mat.unidade}` : null);
      c.agendamento.desabilitar(c.tipo.valor !== 'SAIDA');
      c.motivo.definirAjuda(ajuste ? 'Obrigatório no ajuste.' : null, ajuste ? 'aviso' : 'normal');
    };
    c.tipo.aoMudar(ajustarRotulos);
    c.material.aoMudar(ajustarRotulos);
    ajustarRotulos();
    const f = new Formulario(c);

    Modal.abrir({
      titulo: consumoProprio ? 'Registrar consumo de material' : 'Movimentar estoque', tamanho: 'largo', conteudo: f.elemento,
      botoes: [{ texto: 'Registrar', aoClicar: async (modal) => {
        if (!f.validar()) return;
        const r = await Api.chamar(window.api.estoque.movimentar({
          materialId: Number(c.material.valor), tipo: c.tipo.valor as TipoMovimentacaoValor, quantidade: c.quantidade.numero,
          motivo: c.motivo.valorOuNulo, agendamentoId: c.agendamento.valor ? Number(c.agendamento.valor) : null,
        }));
        modal.fechar();
        Toast.sucesso(`${ROTULO_TIPO[r.movimentacao.tipo]} registrada. Saldo de ${r.material.nome}: ${Formato.numero(r.material.quantidadeAtual)} ${r.material.unidade}.`);
        r.avisos.forEach((a) => Toast.aviso(a));
        await this.atualizar();
      } }],
    });
  }

  private async historico(m: MaterialDTO): Promise<void> {
    const corpo = h('div', {});
    const carregar = async (): Promise<void> => {
      const r = await Api.chamar(window.api.estoque.movimentacoes({ materialId: m.id, ativo: 'todos', limit: 100 }));
      limpar(corpo);
      corpo.append(r.items.length === 0 ? h('div', { class: 'vazio' }, 'Nenhuma movimentação.') : h('div', { class: 'dt__moldura' }, h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Data'), h('th', {}, 'Tipo'), h('th', { class: 'num' }, 'Qtd.'), h('th', {}, 'Motivo'), h('th', {}, 'Por'), h('th', {}, ''))),
        h('tbody', {}, ...r.items.map((mv) => h('tr', { class: mv.ativo ? undefined : 'linha--inativa' },
          h('td', { class: 'nowrap' }, Formato.dataHora(mv.data)),
          h('td', {}, tag(ROTULO_TIPO[mv.tipo], mv.tipo === 'ENTRADA' ? 'ok' : mv.tipo === 'SAIDA' ? 'vinho' : 'aviso'), mv.ativo ? null : h('span', { class: 'dica' }, ' estornada')),
          h('td', { class: 'num' }, `${mv.efeito > 0 ? '+' : '−'}${Formato.numero(mv.quantidade)}`),
          h('td', {}, mv.motivo ?? '—', mv.agendamentoId ? h('span', { class: 'secundario' }, `atendimento #${mv.agendamentoId}`) : null),
          h('td', {}, mv.usuarioNome ?? '—'),
          h('td', {}, this.podeEditar && mv.ativo ? botao('Estornar', async () => {
            if (!(await Modal.confirmar('Estornar movimentação', 'O efeito no saldo será desfeito e o registro ficará marcado como estornado.', 'Estornar', true))) return;
            await Api.chamar(window.api.estoque.estornar(mv.id));
            Toast.sucesso('Movimentação estornada.');
            await carregar();
            await this.atualizar();
          }, 'btn btn--perigo btn--mini') : null)))))));
    };
    await carregar();
    Modal.abrir({ titulo: `Movimentações — ${m.nome}`, tamanho: 'largo', conteudo: corpo });
  }

  private async relatorio(): Promise<void> {
    const r = await Api.chamar(window.api.estoque.relatorio());
    const conteudo: HTMLElement[] = [
      h('div', { class: 'kpis' },
        kpi('Valor do estoque (BRL)', Formato.moeda(r.valorTotalBrl), `${r.totalItens} itens ativos`),
        kpi('Valor do estoque (USD)', Formato.moeda(r.valorTotalUsd, 'USD'), r.cotacaoAtual ? `US$ 1 = R$ ${r.cotacaoAtual.valor.toFixed(4).replace('.', ',')}` : 'sem cotação'),
        kpi('Estoque baixo', String(r.itensEstoqueBaixo), `${r.itensSemPreco} sem preço de custo`, r.itensEstoqueBaixo > 0)),
      cartao('Valor por categoria (BRL)', GraficoBarras.criar(r.porCategoria.map((c) => ({ rotulo: ROTULOS_CATEGORIA[c.categoria], valor: c.valorBrl })), undefined, 'Valor do estoque por categoria') as HTMLElement),
    ];
    if (this.sessao.pode('RELATORIOS_VER', 'ESTOQUE_EDITAR')) {
      const hoje = new Date();
      const consumo = await Api.chamar(window.api.estoque.consumo({ dataInicio: Formato.isoData(Formato.somarDias(hoje, -30)), dataFim: Formato.isoData(hoje) })).catch(() => null);
      if (consumo) {
        conteudo.push(cartao(`Consumo nos últimos 30 dias · ${Formato.moeda(consumo.valorTotalBrl)}`,
          GraficoBarras.criar(consumo.porMaterial.slice(0, 8).map((c) => ({ rotulo: c.rotulo, valor: c.valorBrl })), undefined, 'Consumo por material') as HTMLElement));
      }
    }
    Modal.abrir({ titulo: 'Relatório do estoque', tamanho: 'largo', conteudo });
  }
}
