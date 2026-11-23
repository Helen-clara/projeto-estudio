import type { LembreteDTO, StatusLembreteValor } from '../../shared/lembretes';
import { DataTable } from '../components/DataTable.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato } from '../core/formato.js';
import { botao, seletor, tag, tagStatus } from '../core/ui.js';
import { View } from './View.js';

/** Lembretes por e-mail (enviados, pendentes e com falha) com reenvio manual. */
export class LembretesView extends View {
  private tabela!: DataTable<LembreteDTO>;
  private status = '';
  private readonly resultado = h('div', { 'aria-live': 'polite' });

  private get admin(): boolean { return this.sessao.pode('LEMBRETES_GERENCIAR'); }

  public async render(alvo: HTMLElement): Promise<void> {
    this.tabela = new DataTable<LembreteDTO>({
      busca: false,
      filtros: [seletor('Status', [['', 'Todos os status'], ['PENDENTE', 'Pendentes'], ['ENVIADO', 'Enviados'], ['FALHA', 'Com falha']], this.status, (v) => { this.status = v; this.tabela.irParaPrimeiraPagina(); })],
      acoes: this.admin ? [botao('▶ Processar lembretes agora', () => this.processar(), 'btn')] : [],
      vazio: 'Nenhum lembrete registrado.',
      carregar: (_t, limit, offset) => Api.chamar(window.api.lembretes.listar({ status: (this.status || undefined) as StatusLembreteValor | undefined, limit, offset })),
      colunas: [
        { titulo: 'Atendimento', valor: (l) => [h('strong', { class: 'nowrap' }, Formato.dataHora(l.inicioAgendamento)), h('span', { class: 'secundario' }, `${l.servicoNome} · ${l.profissionalNome}`)] },
        { titulo: 'Cliente', valor: (l) => [h('span', {}, l.clienteNome), h('span', { class: 'secundario' }, l.destinatario ?? 'sem e-mail')] },
        { titulo: 'Status', valor: (l) => h('div', { class: 'chips' }, tagStatus(l.status), l.simulado ? tag('simulado', 'neutra') : null) },
        { titulo: 'Tentativas', alinhar: 'direita', valor: (l) => String(l.tentativas) },
        { titulo: 'Detalhe', valor: (l) => h('span', { class: 'dica' }, l.enviadoEm && !l.simulado ? `Enviado em ${Formato.dataHora(l.enviadoEm)}`
          : l.simulado ? `Simulado em ${Formato.dataHora(l.enviadoEm)} (SMTP não configurado)` : l.erro ?? `Previsto para ${Formato.dataHora(l.agendadoPara)}`) },
        { titulo: 'Ações', valor: (l) => h('div', { class: 'acoes' },
          // Só faz sentido reenviar para atendimentos que ainda vão acontecer.
          l.inicioAgendamento > Formato.isoData(new Date()) ? botao('Reenviar', () => this.reenviar(l)) : null,
          this.admin ? botao('⊘', async () => {
            if (!(await Modal.confirmar('Excluir lembrete', 'O lembrete deixa de ser enviado automaticamente (exclusão lógica).', 'Excluir', true))) return;
            await Api.chamar(window.api.lembretes.excluir(l.id));
            Toast.sucesso('Lembrete excluído.');
            await this.tabela.recarregar();
          }, 'btn btn--perigo btn--mini', 'Excluir lembrete') : null) },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' },
      h('div', { class: 'alerta alerta--info' },
        '✉️ Um dia antes de cada atendimento, o cliente recebe um e-mail com data, horário, profissional, procedimento, orientações de preparo e uma dica conforme a previsão do tempo (Open-Meteo). ',
        'O agendador roda ao abrir o app, todo dia às 09:00 e a cada hora; falhas são tentadas de novo até 3 vezes. Sem SMTP configurado no .env, os envios são simulados.'),
      this.resultado, this.tabela.elemento));
    await this.tabela.recarregar();
  }

  private async processar(): Promise<void> {
    const r = await Api.chamar(window.api.lembretes.rodarAgora());
    limpar(this.resultado);
    this.resultado.append(h('div', { class: `alerta ${r.falhas ? 'alerta--aviso' : 'alerta--ok'}` },
      r.emAndamento ? 'Já havia um processamento em andamento.'
        : r.verificados === 0 ? 'Nenhum lembrete pendente para amanhã.'
          : `Processado: ${r.verificados} verificado(s) — ${r.enviados} enviado(s), ${r.simulados} simulado(s), ${r.falhas} falha(s), ${r.ignorados} ignorado(s).`,
      ...r.detalhes.filter((d) => d.motivo).map((d) => h('div', { class: 'dica' }, `Agendamento #${d.agendamentoId}: ${d.motivo}`))));
    await this.tabela.recarregar();
  }

  private async reenviar(l: LembreteDTO): Promise<void> {
    const r = await Api.chamar(window.api.lembretes.reenviar(l.id));
    if (r.resultado === 'FALHA' || r.resultado === 'IGNORADO') Toast.aviso(`${r.resultado === 'FALHA' ? 'Falha' : 'Ignorado'}: ${r.motivo ?? ''}`);
    else Toast.sucesso(r.resultado === 'ENVIADO_SIMULADO' ? 'Lembrete reenviado (modo simulação).' : 'Lembrete reenviado.');
    await this.tabela.recarregar();
  }
}
