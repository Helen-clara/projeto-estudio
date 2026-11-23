import type { AgendamentoDTO } from '../../shared/agenda';
import type { MaterialDTO } from '../../shared/estoque';
import { GraficoBarras, GraficoLinha } from '../components/Grafico.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato } from '../core/formato.js';
import { cartao, kpi, tagStatus } from '../core/ui.js';
import { View } from './View.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Painel inicial: agenda do dia, próximos atendimentos, estoque baixo e indicadores. */
export class DashboardView extends View {
  public async render(alvo: HTMLElement): Promise<void> {
    const hoje = new Date();
    const verEstoque = this.sessao.pode('ESTOQUE_VER');
    const verRelatorios = this.sessao.pode('RELATORIOS_VER');
    const verAgenda = this.sessao.pode('AGENDA_VER_TODOS', 'AGENDA_VER_PROPRIA');
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const seisMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);

    const [agenda, alertas, mes, semestre] = await Promise.all([
      verAgenda ? Api.chamar(window.api.agenda.listar({ dataInicio: Formato.isoData(hoje), dataFim: Formato.isoData(Formato.somarDias(hoje, 7)), status: ['AGENDADO', 'CONFIRMADO'], limit: 200 })) : null,
      verEstoque ? Api.chamar(window.api.estoque.alertas()).catch(() => [] as MaterialDTO[]) : null,
      verRelatorios ? Api.chamar(window.api.estatisticas.resumo({ dataInicio: Formato.isoData(inicioMes), dataFim: Formato.isoData(hoje) })) : null,
      verRelatorios ? Api.chamar(window.api.estatisticas.resumo({ dataInicio: Formato.isoData(seisMeses), dataFim: Formato.isoData(hoje) })) : null,
    ]);

    const itens = agenda?.items ?? [];
    const deHoje = itens.filter((a) => a.inicio.startsWith(Formato.isoData(hoje)));
    const nomeMes = `${MESES[hoje.getMonth()]}/${hoje.getFullYear()}`;

    limpar(alvo);
    const pagina = h('div', { class: 'pagina' },
      h('p', { class: 'dica', style: 'font-size:14px' }, `Olá, ${this.sessao.primeiroNome}! ${this.sessao.pode('AGENDA_VER_TODOS') ? 'Este é o resumo do estúdio.' : 'Este é o resumo da sua agenda.'}`),
      h('div', { class: 'kpis' },
        verAgenda ? kpi('Atendimentos hoje', String(deHoje.length), deHoje.length ? `próximo às ${Formato.hora(deHoje[0].inicio)}` : 'nenhum marcado') : null,
        verAgenda ? kpi('Próximos 7 dias', String(agenda?.total ?? 0), 'agendados ou confirmados') : null,
        verEstoque ? kpi('Estoque baixo', String(alertas?.length ?? 0), alertas?.length ? 'materiais no mínimo' : 'tudo em ordem', (alertas?.length ?? 0) > 0) : null,
        mes ? kpi(`Faturamento ${nomeMes}`, Formato.moeda(mes.faturamento), `${mes.atendimentosConcluidos} atendimento(s) concluído(s)`) : null,
        mes ? kpi('Ticket médio no mês', Formato.moeda(mes.ticketMedio), `cancelamentos ${mes.taxaCancelamento}% · faltas ${mes.taxaFalta}%`, true) : null),
      h('div', { class: 'grade-3' },
        verAgenda ? cartao('Próximos atendimentos', this.proximos(itens), h('a', { href: '#/agenda', class: 'btn btn--fantasma btn--mini' }, 'Abrir agenda →')) : null,
        verEstoque ? cartao('Estoque baixo', this.estoqueBaixo(alertas ?? []), h('a', { href: '#/estoque', class: 'btn btn--fantasma btn--mini' }, 'Ver estoque →')) : null));

    if (semestre) {
      pagina.append(
        h('div', { class: 'grade-2' },
          cartao('Faturamento por mês (últimos 6 meses)', GraficoLinha.criar(this.mesesCompletos(seisMeses, semestre.porMes), undefined, 'Faturamento por mês') as HTMLElement),
          cartao('Faturamento por serviço (6 meses)', GraficoBarras.criar(semestre.porServico.slice(0, 6).map((s) => ({ rotulo: s.rotulo, valor: s.faturamento })), undefined, 'Faturamento por serviço') as HTMLElement)),
        h('div', { class: 'grade-2' },
          cartao('Atendimentos por profissional (6 meses)', GraficoBarras.criar(semestre.porProfissional.map((p) => ({ rotulo: p.rotulo, valor: p.atendimentos })), (v) => `${v} atend.`, 'Atendimentos por profissional') as HTMLElement),
          cartao('Clientes no período', h('div', { class: 'kpis' },
            kpi('Clientes novos', String(semestre.clientesNovos), 'primeiro atendimento no período'),
            kpi('Recorrentes', String(semestre.clientesRecorrentes), 'já atendidos antes', true)))));
    }
    alvo.append(pagina);
  }

  private proximos(itens: AgendamentoDTO[]): HTMLElement {
    if (itens.length === 0) return h('div', { class: 'vazio' }, 'Nenhum atendimento nos próximos 7 dias.');
    return h('div', { class: 'lista' }, ...itens.slice(0, 7).map((a) => h('a', { href: '#/agenda', class: 'item-lista', style: 'text-decoration:none;color:inherit' },
      h('div', { class: 'item-lista__hora' }, Formato.hora(a.inicio), h('small', {}, Formato.data(a.inicio).slice(0, 5))),
      h('div', { class: 'item-lista__info' }, h('span', {}, a.clienteNome), h('small', {}, `${a.servicoNome} · ${a.profissionalNome}`)),
      tagStatus(a.status))));
  }

  private estoqueBaixo(alertas: MaterialDTO[]): HTMLElement {
    if (alertas.length === 0) return h('div', { class: 'vazio' }, '✔ Nenhum material abaixo do mínimo.');
    return h('div', { class: 'lista' }, ...alertas.slice(0, 6).map((m) => h('div', { class: 'item-lista', style: 'grid-template-columns:minmax(0,1fr) auto' },
      h('div', { class: 'item-lista__info' }, h('span', {}, m.nome), h('small', {}, `mínimo ${Formato.numero(m.estoqueMinimo)} ${m.unidade}`)),
      h('strong', { style: 'color:var(--erro)' }, `${Formato.numero(m.quantidadeAtual)} ${m.unidade}`))));
  }

  /** Garante os 6 meses no gráfico (meses sem atendimento aparecem com zero). */
  private mesesCompletos(inicio: Date, porMes: Array<{ chave: string; faturamento: number }>): Array<{ rotulo: string; valor: number }> {
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { rotulo: MESES[d.getMonth()], valor: porMes.find((m) => m.chave === chave)?.faturamento ?? 0 };
    });
  }
}
