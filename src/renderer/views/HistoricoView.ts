import type { AtendimentoDTO } from '../../shared/agenda';
import { DataTable } from '../components/DataTable.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato } from '../core/formato.js';
import { kpi } from '../core/ui.js';
import { View } from './View.js';

/** Histórico de atendimentos concluídos por período (profissional vê apenas os próprios). */
export class HistoricoView extends View {
  private tabela!: DataTable<AtendimentoDTO>;
  private readonly resumo = h('div', { class: 'kpis' });
  private de = Formato.isoData(new Date(new Date().getFullYear(), 0, 1));
  private ate = Formato.isoData(new Date());

  public async render(alvo: HTMLElement): Promise<void> {
    const entradaDe = h('input', { type: 'date', class: 'entrada', 'aria-label': 'Data inicial', value: this.de });
    const entradaAte = h('input', { type: 'date', class: 'entrada', 'aria-label': 'Data final', value: this.ate });
    const aplicar = (): void => { this.de = entradaDe.value; this.ate = entradaAte.value; this.tabela.irParaPrimeiraPagina(); };
    entradaDe.addEventListener('change', aplicar);
    entradaAte.addEventListener('change', aplicar);

    this.tabela = new DataTable<AtendimentoDTO>({
      busca: false,
      filtros: [h('span', { class: 'dica' }, 'De'), entradaDe, h('span', { class: 'dica' }, 'até'), entradaAte],
      vazio: 'Nenhum atendimento concluído no período.',
      carregar: async (_t, limit, offset) => {
        const r = await Api.chamar(window.api.historico.porPeriodo({ dataInicio: this.de, dataFim: this.ate, limit, offset }));
        limpar(this.resumo);
        this.resumo.append(
          kpi('Atendimentos concluídos', String(r.total), `${Formato.data(this.de)} a ${Formato.data(this.ate)}`),
          kpi('Total cobrado', Formato.moeda(r.valorTotal), this.sessao.pode('HISTORICO_VER_TODOS') ? 'todos os profissionais' : 'somente os seus atendimentos', true));
        return r;
      },
      colunas: [
        { titulo: 'Data', valor: (a) => h('span', { class: 'nowrap' }, Formato.dataHora(a.data)) },
        { titulo: 'Cliente', valor: (a) => a.clienteNome },
        { titulo: 'Procedimento', valor: (a) => a.servicoNome },
        { titulo: 'Profissional', valor: (a) => a.profissionalNome },
        { titulo: 'Valor', alinhar: 'direita', valor: (a) => Formato.moeda(a.valorCobrado) },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' }, this.resumo, this.tabela.elemento));
    await this.tabela.recarregar();
  }
}
