import type { AgendamentoDTO, StatusAgendamentoValor } from '../../shared/agenda';
import type { ProfissionalDTO } from '../../shared/dtos';
import { FormField, Formulario } from '../components/FormField.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato } from '../core/formato.js';
import { botao, tagStatus } from '../core/ui.js';
import { View } from './View.js';

type Visao = 'dia' | 'semana';

/** Faixa de horário exibida na grade (minutos desde 00:00) e escala. */
const INICIO_GRADE = 8 * 60;
const FIM_GRADE = 21 * 60;
const PX_POR_MIN = 1.15;
const STATUS_VISIVEIS: StatusAgendamentoValor[] = ['AGENDADO', 'CONFIRMADO', 'CONCLUIDO', 'FALTOU'];

interface ColunaAgenda {
  chave: string;
  titulo: string;
  subtitulo: string;
  data: Date;
  profissionalId: number;
  hoje: boolean;
  fechado: boolean;
}

/**
 * Agenda com visão diária (colunas = profissionais) e semanal (colunas = dias de um
 * profissional). Clique num horário vago para agendar; clique num bloco para ver/agir.
 */
export class AgendaView extends View {
  private visao: Visao = 'dia';
  private data = AgendaView.hojeUtil();
  private profissionalSemana = 0;
  private mostrarCancelados = false;
  private profissionais: ProfissionalDTO[] = [];
  private carregados: AgendamentoDTO[] = [];
  private readonly feriados = new Map<string, string | null>();
  private grade!: HTMLElement;
  private rotuloPeriodo!: HTMLElement;
  private botoesVisao!: Record<Visao, HTMLButtonElement>;
  private seletorProfissional!: HTMLSelectElement;

  /** Hoje, ou a segunda-feira seguinte quando hoje é domingo (estúdio fechado). */
  private static hojeUtil(): Date {
    const d = new Date();
    return d.getDay() === 0 ? Formato.somarDias(d, 1) : d;
  }

  private get verTodos(): boolean { return this.sessao.pode('AGENDA_VER_TODOS'); }
  private get podeAlterar(): boolean { return this.sessao.pode('AGENDA_EDITAR', 'AGENDA_GERENCIAR_PROPRIA'); }

  public async render(alvo: HTMLElement): Promise<void> {
    if (this.verTodos) {
      this.profissionais = (await Api.chamar(window.api.profissionais.listar({ limit: 100 }))).items;
    } else {
      const u = this.sessao.usuario;
      this.profissionais = [{ id: u.id, nome: u.nome, especialidade: u.especialidade ?? 'TATUADOR', ativo: true, cpf: null, email: '', telefone: null, login: u.login }];
      this.visao = 'semana';
    }
    this.profissionalSemana = this.profissionais[0]?.id ?? 0;
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' }, this.barra(), this.legenda(), this.grade = h('div', { class: 'ag-grade', 'aria-live': 'polite' })));
    await this.recarregar();
  }

  public novo(): void {
    if (this.podeAlterar) void this.formulario(null, null);
  }

  // ------------------------------------------------------------- barra e navegação

  private barra(): HTMLElement {
    this.rotuloPeriodo = h('div', { class: 'ag-periodo', 'aria-live': 'polite' });
    this.botoesVisao = {
      dia: h('button', { type: 'button', 'data-visao': 'dia', onclick: () => this.trocarVisao('dia') }, 'Dia'),
      semana: h('button', { type: 'button', 'data-visao': 'semana', onclick: () => this.trocarVisao('semana') }, 'Semana'),
    };
    this.seletorProfissional = h('select', { class: 'entrada', 'aria-label': 'Profissional da visão semanal' },
      ...this.profissionais.map((p) => h('option', { value: String(p.id) }, p.nome)));
    this.seletorProfissional.addEventListener('change', () => { this.profissionalSemana = Number(this.seletorProfissional.value); void this.recarregar(); });
    const cancelados = h('input', { type: 'checkbox', id: 'ag-cancelados' });
    cancelados.addEventListener('change', () => { this.mostrarCancelados = cancelados.checked; void this.recarregar(); });

    return h('div', { class: 'ag-barra' },
      h('button', { type: 'button', class: 'btn btn--sec btn--icone', 'aria-label': 'Período anterior', onclick: () => this.mover(-1) }, '‹'),
      h('button', { type: 'button', class: 'btn btn--sec', onclick: () => { this.data = AgendaView.hojeUtil(); void this.recarregar(); } }, 'Hoje'),
      h('button', { type: 'button', class: 'btn btn--sec btn--icone', 'aria-label': 'Próximo período', onclick: () => this.mover(1) }, '›'),
      this.rotuloPeriodo,
      this.verTodos ? h('div', { class: 'ag-alternar', role: 'group', 'aria-label': 'Visão' }, this.botoesVisao.dia, this.botoesVisao.semana) : null,
      this.verTodos ? this.seletorProfissional : null,
      h('label', { class: 'campo--check', style: 'display:inline-flex;gap:6px;align-items:center;color:var(--suave);font-size:13px' }, cancelados, 'Mostrar cancelados'),
      h('span', { class: 'espaco' }),
      this.podeAlterar ? h('button', { type: 'button', class: 'btn', onclick: () => this.novo() }, '+ Novo agendamento') : null);
  }

  private legenda(): HTMLElement {
    const cores: Array<[string, string]> = [['Agendado', 'var(--info)'], ['Confirmado', 'var(--ouro)'], ['Concluído', 'var(--ok)'], ['Faltou', 'var(--aviso)'], ['Cancelado', 'var(--erro)']];
    return h('div', { class: 'ag-legenda', 'aria-label': 'Legenda de cores' },
      ...cores.map(([t, c]) => { const i = h('i'); i.style.background = c; return h('span', {}, i, t); }),
      h('span', {}, '· Clique num horário vago para agendar'));
  }

  private trocarVisao(v: Visao): void {
    this.visao = v;
    void this.recarregar();
  }

  private mover(direcao: number): void {
    this.data = Formato.somarDias(this.data, direcao * (this.visao === 'dia' ? 1 : 7));
    void this.recarregar();
  }

  // ------------------------------------------------------------- dados e grade

  private colunas(): ColunaAgenda[] {
    const hoje = Formato.isoData(new Date());
    if (this.visao === 'dia') {
      const d = new Date(this.data.getFullYear(), this.data.getMonth(), this.data.getDate());
      return this.profissionais.map((p) => ({
        chave: `${p.id}`, titulo: p.nome, subtitulo: p.especialidade === 'TATUADOR' ? 'Tatuagem' : 'Estética',
        data: d, profissionalId: p.id, hoje: Formato.isoData(d) === hoje, fechado: d.getDay() === 0,
      }));
    }
    const seg = Formato.inicioSemana(this.data);
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const d = Formato.somarDias(seg, i);
      return {
        chave: Formato.isoData(d), titulo: `${Formato.diaSemana(d, true)} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        subtitulo: '', data: d, profissionalId: this.profissionalSemana, hoje: Formato.isoData(d) === hoje, fechado: false,
      };
    });
  }

  private async recarregar(): Promise<void> {
    this.botoesVisao.dia.setAttribute('aria-pressed', String(this.visao === 'dia'));
    this.botoesVisao.semana.setAttribute('aria-pressed', String(this.visao === 'semana'));
    this.seletorProfissional.hidden = this.visao !== 'semana';
    this.seletorProfissional.value = String(this.profissionalSemana);

    const colunas = this.colunas();
    const inicio = colunas[0]?.data ?? this.data;
    const fim = colunas[colunas.length - 1]?.data ?? this.data;
    this.rotuloPeriodo.textContent = this.visao === 'dia'
      ? `${Formato.diaSemana(inicio).replace(/^./, (c) => c.toUpperCase())}, ${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`
      : `${Formato.data(Formato.isoData(inicio))} – ${Formato.data(Formato.isoData(fim))}`;

    limpar(this.grade);
    this.grade.append(h('div', { class: 'vazio' }, h('span', { class: 'carregando-inline', 'aria-hidden': 'true' }), ' Carregando agenda…'));
    try {
      const [pagina] = await Promise.all([
        Api.chamar(window.api.agenda.listar({
          dataInicio: Formato.isoData(inicio), dataFim: Formato.isoData(fim), limit: 500,
          profissionalId: this.visao === 'semana' && this.verTodos ? this.profissionalSemana : undefined,
          status: this.mostrarCancelados ? undefined : STATUS_VISIVEIS,
        })),
        this.carregarFeriados(colunas.map((c) => c.data)),
      ]);
      this.carregados = pagina.items;
      this.desenhar(colunas);
    } catch (e) {
      limpar(this.grade);
      this.grade.append(h('div', { class: 'dt__estado' }, h('strong', {}, 'Não foi possível carregar a agenda.'), (e as Error).message, h('br'),
        h('button', { type: 'button', class: 'btn btn--sec btn--mini', onclick: () => void this.recarregar() }, 'Tentar novamente')));
    }
  }

  /** Feriados consultados uma vez por data (a BrasilAPI já tem cache por ano no main). */
  private async carregarFeriados(datas: Date[]): Promise<void> {
    const faltam = [...new Set(datas.map((d) => Formato.isoData(d)))].filter((d) => !this.feriados.has(d));
    await Promise.all(faltam.map(async (d) => {
      const r = await Api.chamar(window.api.agenda.verificarFeriado(d)).catch(() => null);
      this.feriados.set(d, r?.feriado ?? null);
    }));
  }

  private desenhar(colunas: ColunaAgenda[]): void {
    limpar(this.grade);
    const altura = (FIM_GRADE - INICIO_GRADE) * PX_POR_MIN;
    const tabela = h('div', { class: 'ag-tabela', role: 'grid', 'aria-label': 'Agenda' });
    tabela.style.gridTemplateColumns = `60px repeat(${colunas.length}, minmax(140px, 1fr))`;

    tabela.append(h('div', { class: 'ag-canto' }));
    for (const c of colunas) {
      const feriado = this.feriados.get(Formato.isoData(c.data));
      tabela.append(h('div', { class: `ag-cabecalho${c.hoje ? ' ag-cabecalho--hoje' : ''}${feriado ? ' ag-cabecalho--feriado' : ''}`, role: 'columnheader' },
        h('strong', {}, c.titulo), c.subtitulo ? h('small', {}, c.subtitulo) : null,
        feriado ? h('span', { class: 'ag-feriado', title: 'Feriado nacional (BrasilAPI)' }, `🎌 ${feriado}`) : null));
    }

    const horas = h('div', { class: 'ag-horas' });
    horas.style.height = `${altura}px`;
    for (let m = INICIO_GRADE; m <= FIM_GRADE; m += 60) {
      const rotulo = h('span', { class: 'ag-hora' }, `${String(m / 60).padStart(2, '0')}:00`);
      rotulo.style.top = `${(m - INICIO_GRADE) * PX_POR_MIN}px`;
      horas.append(rotulo);
    }
    tabela.append(horas);

    for (const c of colunas) tabela.append(this.coluna(c, altura));
    this.grade.append(tabela);

    // Rola até o primeiro atendimento do período; sem atendimentos, até as 9h
    // (ou até a hora atual, quando a agenda é de hoje).
    const minutos = (iso: string): number => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
    const primeiro = this.carregados.length ? Math.min(...this.carregados.map((a) => minutos(a.inicio))) : null;
    const agora = new Date();
    const alvoMin = primeiro !== null ? primeiro - 30
      : colunas.some((c) => c.hoje) ? Math.max(INICIO_GRADE, agora.getHours() * 60 - 60) : 9 * 60;
    this.grade.scrollTop = Math.max(0, (alvoMin - INICIO_GRADE) * PX_POR_MIN - 20);
  }

  private coluna(c: ColunaAgenda, altura: number): HTMLElement {
    const col = h('div', { class: `ag-coluna${c.fechado ? ' ag-coluna--fechado' : ''}`, role: 'gridcell', 'aria-label': `${c.titulo} ${Formato.data(Formato.isoData(c.data))}` });
    col.style.height = `${altura}px`;
    for (let m = INICIO_GRADE; m < FIM_GRADE; m += 30) {
      const linha = h('div', { class: `ag-linha${m % 60 ? ' ag-linha--meia' : ''}` });
      linha.style.top = `${(m - INICIO_GRADE) * PX_POR_MIN}px`;
      col.append(linha);
    }
    if (c.hoje) {
      const agora = new Date();
      const min = agora.getHours() * 60 + agora.getMinutes();
      if (min > INICIO_GRADE && min < FIM_GRADE) {
        const marca = h('div', { class: 'ag-agora', title: 'Agora' });
        marca.style.top = `${(min - INICIO_GRADE) * PX_POR_MIN}px`;
        col.append(marca);
      }
    }
    const dia = Formato.isoData(c.data);
    this.carregados
      .filter((a) => a.profissionalId === c.profissionalId && a.inicio.startsWith(dia))
      .forEach((a) => col.append(this.bloco(a)));

    if (this.podeAlterar && !c.fechado) {
      col.addEventListener('click', (e) => {
        if (e.target !== col) return;
        const y = e.offsetY;
        const min = Math.floor((INICIO_GRADE + y / PX_POR_MIN) / 30) * 30;
        const inicio = new Date(c.data.getFullYear(), c.data.getMonth(), c.data.getDate(), 0, min);
        void this.formulario(null, { inicio, profissionalId: c.profissionalId });
      });
    }
    return col;
  }

  private bloco(a: AgendamentoDTO): HTMLElement {
    const [hi, mi] = Formato.hora(a.inicio).split(':').map(Number);
    const [hf, mf] = Formato.hora(a.fim).split(':').map(Number);
    const ini = hi * 60 + mi;
    const fim = hf * 60 + mf;
    const b = h('button', { type: 'button', class: `ag-bloco ag-bloco--${a.status}`, title: `${a.clienteNome} — ${a.servicoNome}` },
      h('strong', {}, a.clienteNome),
      h('span', {}, `${Formato.hora(a.inicio)}–${Formato.hora(a.fim)} · ${a.servicoNome}`),
      this.visao === 'semana' ? null : h('span', {}, a.status === 'CONCLUIDO' ? Formato.moeda(a.valorCobrado) : ''));
    b.style.top = `${(Math.max(ini, INICIO_GRADE) - INICIO_GRADE) * PX_POR_MIN}px`;
    b.style.height = `${Math.max(24, (Math.min(fim, FIM_GRADE) - Math.max(ini, INICIO_GRADE)) * PX_POR_MIN - 2)}px`;
    b.addEventListener('click', () => this.detalhes(a));
    return b;
  }

  // ------------------------------------------------------------- detalhes e ações

  private detalhes(a: AgendamentoDTO): void {
    const alterar = this.podeAlterar && (a.status === 'AGENDADO' || a.status === 'CONFIRMADO');
    const executar = async (modal: Modal, acao: Promise<unknown>, mensagem: string): Promise<void> => {
      await acao;
      modal.fechar();
      Toast.sucesso(mensagem);
      await this.recarregar();
    };
    const acoes: HTMLElement[] = [];
    let modal: Modal | null = null;
    if (alterar && a.status === 'AGENDADO') acoes.push(botao('Confirmar', () => executar(modal as Modal, Api.chamar(window.api.agenda.confirmar(a.id)), 'Agendamento confirmado.'), 'btn btn--sec'));
    if (this.sessao.pode('ATENDIMENTO_CONCLUIR') && a.status === 'CONFIRMADO') acoes.push(botao('Concluir atendimento', () => { modal?.fechar(); return this.concluir(a); }, 'btn'));
    if (alterar) {
      acoes.push(botao('Editar', () => { modal?.fechar(); return this.formulario(a, null); }, 'btn btn--sec'));
      acoes.push(botao('Faltou', () => executar(modal as Modal, Api.chamar(window.api.agenda.marcarFalta(a.id)), 'Falta registrada.'), 'btn btn--sec'));
      acoes.push(botao('Cancelar agendamento', () => { modal?.fechar(); this.cancelar(a); }, 'btn btn--perigo'));
    }
    if (this.sessao.pode('AGENDA_EDITAR') && (a.status === 'CANCELADO' || a.status === 'FALTOU')) {
      acoes.push(botao('Remover da agenda', async () => {
        if (!(await Modal.confirmar('Remover da agenda', 'O registro será ocultado da agenda (exclusão lógica).', 'Remover', true))) return;
        await executar(modal as Modal, Api.chamar(window.api.agenda.excluir(a.id)), 'Agendamento removido da agenda.');
      }, 'btn btn--perigo'));
    }

    modal = Modal.abrir({
      titulo: 'Agendamento',
      conteudo: [
        h('dl', { class: 'ag-detalhes' },
          h('dt', {}, 'Status'), h('dd', {}, tagStatus(a.status)),
          h('dt', {}, 'Cliente'), h('dd', {}, a.clienteNome),
          h('dt', {}, 'Procedimento'), h('dd', {}, a.servicoNome),
          h('dt', {}, 'Profissional'), h('dd', {}, a.profissionalNome),
          h('dt', {}, 'Data e horário'), h('dd', {}, `${Formato.data(a.inicio)}, ${Formato.hora(a.inicio)} às ${Formato.hora(a.fim)}`),
          a.valorCobrado !== null ? h('dt', {}, 'Valor cobrado') : null, a.valorCobrado !== null ? h('dd', {}, Formato.moeda(a.valorCobrado)) : null,
          h('dt', {}, 'Observações'), h('dd', { style: 'white-space:pre-line' }, a.observacoes ?? '—')),
        acoes.length ? h('div', { class: 'acoes' }, ...acoes) : null,
      ],
    });
  }

  private async concluir(a: AgendamentoDTO): Promise<void> {
    const servico = await Api.chamar(window.api.servicos.obter(a.servicoId)).catch(() => null);
    const f = new Formulario({
      valor: new FormField({ rotulo: 'Valor cobrado (R$)', tipo: 'numero', obrigatorio: true, min: 0, passo: '0.01', largura: 2, valor: servico?.preco ?? '', ajuda: servico ? `Preço de tabela: ${Formato.moeda(servico.preco)}` : undefined }),
      obs: new FormField({ rotulo: 'Observações do atendimento', tipo: 'textarea', largura: 4, maxLength: 500 }),
    });
    Modal.abrir({
      titulo: `Concluir — ${a.clienteNome}`,
      conteudo: [h('p', { class: 'dica' }, `${a.servicoNome} com ${a.profissionalNome}, ${Formato.dataHora(a.inicio)}. O atendimento entra no histórico do cliente.`), f.elemento],
      botoes: [{ texto: 'Concluir atendimento', aoClicar: async (m) => {
        if (!f.validar()) return;
        await Api.chamar(window.api.agenda.concluir({ id: a.id, valorCobrado: f.campos.valor.numero, observacoes: f.campos.obs.valorOuNulo }));
        m.fechar();
        Toast.sucesso('Atendimento concluído e registrado no histórico.');
        await this.recarregar();
      } }],
    });
  }

  private cancelar(a: AgendamentoDTO): void {
    const motivo = new FormField({ rotulo: 'Motivo do cancelamento', largura: 6, maxLength: 240, placeholder: 'Ex.: cliente pediu para remarcar' });
    Modal.abrir({
      titulo: 'Cancelar agendamento', tamanho: 'estreito',
      conteudo: [h('p', {}, `${a.clienteNome} · ${a.servicoNome} · ${Formato.dataHora(a.inicio)}`), h('div', { class: 'form' }, motivo.elemento)],
      botoes: [{ texto: 'Cancelar agendamento', classe: 'btn--vinho', aoClicar: async (m) => {
        await Api.chamar(window.api.agenda.cancelar({ id: a.id, motivo: motivo.valorOuNulo }));
        m.fechar();
        Toast.sucesso('Agendamento cancelado.');
        await this.recarregar();
      } }],
    });
  }

  // ------------------------------------------------------------- formulário (criar/editar)

  private async formulario(atual: AgendamentoDTO | null, sugestao: { inicio: Date; profissionalId: number } | null): Promise<void> {
    const clientes = await Api.chamar(window.api.clientes.listar({ limit: 500 }));
    const proprio = !this.sessao.pode('AGENDA_EDITAR');
    const profId = atual?.profissionalId ?? sugestao?.profissionalId ?? (proprio ? this.sessao.usuario.id : this.profissionais[0]?.id);
    const inicio = atual ? atual.inicio : sugestao ? `${Formato.isoData(sugestao.inicio)}T${String(sugestao.inicio.getHours()).padStart(2, '0')}:${String(sugestao.inicio.getMinutes()).padStart(2, '0')}` : null;
    const amanha = Formato.somarDias(new Date(), 1);

    const c = {
      cliente: new FormField({ rotulo: 'Cliente', tipo: 'select', obrigatorio: true, largura: 6,
        opcoes: [['', 'Selecione o cliente…'], ...clientes.items.map((x): [string, string] => [String(x.id), `${x.nome} — ${Formato.cpf(x.cpf)}${x.menorDeIdade ? ' (menor)' : ''}`])],
        valor: atual ? String(atual.clienteId) : '' }),
      profissional: new FormField({ rotulo: 'Profissional', tipo: 'select', obrigatorio: true, largura: 3,
        opcoes: this.profissionais.map((p): [string, string] => [String(p.id), p.nome]), valor: String(profId ?? ''), desabilitado: proprio }),
      servico: new FormField({ rotulo: 'Procedimento', tipo: 'select', obrigatorio: true, largura: 3, opcoes: [['', 'Carregando…']] }),
      data: new FormField({ rotulo: 'Data', tipo: 'data', obrigatorio: true, largura: 2, valor: inicio ? inicio.slice(0, 10) : Formato.isoData(amanha.getDay() === 0 ? Formato.somarDias(amanha, 1) : amanha) }),
      hora: new FormField({ rotulo: 'Início', tipo: 'hora', obrigatorio: true, largura: 2, passo: 900, valor: inicio ? Formato.hora(inicio) : '14:00' }),
      obs: new FormField({ rotulo: 'Observações', tipo: 'textarea', largura: 6, valor: atual?.observacoes, maxLength: 2000 }),
    };
    const avisos = h('div', { 'aria-live': 'polite' });
    const f = new Formulario(c, h('p', { class: 'dica campo--2', style: 'align-self:end' }, 'O término é calculado pela duração do procedimento.'));
    const duracoes = new Map<string, number>();

    const carregarServicos = async (): Promise<void> => {
      const lista = await Api.chamar(window.api.profissionais.listarServicos(Number(c.profissional.valor))).catch(() => []);
      duracoes.clear();
      lista.forEach((s) => duracoes.set(String(s.id), s.duracaoMinutos));
      c.servico.definirOpcoes(
        [['', lista.length ? 'Selecione o procedimento…' : 'Profissional sem serviços vinculados'], ...lista.map((s): [string, string] => [String(s.id), `${s.nome} · ${s.duracaoMinutos} min · ${Formato.moeda(s.preco)}`])],
        atual && String(atual.profissionalId) === c.profissional.valor ? String(atual.servicoId) : '');
    };

    let confirmarFeriado = false;
    const verificar = async (): Promise<void> => {
      confirmarFeriado = false;
      limpar(avisos);
      if (!c.data.valor) return;
      const fer = await Api.chamar(window.api.agenda.verificarFeriado(c.data.valor)).catch(() => null);
      if (fer?.feriado) avisos.append(h('div', { class: 'alerta alerta--aviso' }, `🎌 ${Formato.data(c.data.valor)} é feriado nacional (${fer.feriado}). Você poderá confirmar mesmo assim.`));
      const conflito = this.conflitoLocal(Number(c.profissional.valor), c.data.valor, c.hora.valor, duracoes.get(c.servico.valor), atual?.id);
      if (conflito) avisos.append(h('div', { class: 'alerta alerta--erro' }, `⚠ Conflito de horário: ${conflito}.`));
    };
    c.profissional.aoMudar(() => void carregarServicos().then(verificar));
    [c.data, c.hora, c.servico].forEach((x) => x.aoMudar(() => void verificar()));
    await carregarServicos();
    await verificar();

    Modal.abrir({
      titulo: atual ? 'Editar agendamento' : 'Novo agendamento',
      tamanho: 'largo',
      conteudo: [f.elemento, avisos],
      botoes: [{ texto: atual ? 'Salvar alterações' : 'Agendar', aoClicar: async (m) => {
        if (!f.validar()) return;
        const dados = {
          clienteId: Number(c.cliente.valor), profissionalId: Number(c.profissional.valor), servicoId: Number(c.servico.valor),
          inicio: `${c.data.valor}T${c.hora.valor}`, observacoes: c.obs.valorOuNulo, confirmarFeriado,
        };
        const r = await Api.chamar(atual ? window.api.agenda.editar({ id: atual.id, dados }) : window.api.agenda.criar(dados));
        if (r.requerConfirmacao) {
          confirmarFeriado = true;
          limpar(avisos);
          avisos.append(h('div', { class: 'alerta alerta--aviso' }, ...r.avisos, ' Clique de novo para confirmar mesmo assim.'));
          return;
        }
        m.fechar();
        Toast.sucesso(atual ? 'Agendamento atualizado.' : 'Agendamento criado.');
        r.avisos.forEach((x) => Toast.aviso(x));
        // Mostra o dia (e, na visão semanal, o profissional) do agendamento salvo.
        if (r.agendamento) {
          this.data = Formato.paraData(r.agendamento.inicio);
          this.profissionalSemana = r.agendamento.profissionalId;
        }
        await this.recarregar();
      } }],
    });
  }

  /** Conflito com os agendamentos já carregados na tela (o main confere de novo ao salvar). */
  private conflitoLocal(profissionalId: number, data: string, hora: string, duracao: number | undefined, ignorarId?: number): string | null {
    if (!data || !hora || !duracao) return null;
    const [hh, mm] = hora.split(':').map(Number);
    const ini = hh * 60 + mm;
    const fim = ini + duracao;
    const choque = this.carregados.find((a) => {
      if (a.id === ignorarId || a.profissionalId !== profissionalId || !a.inicio.startsWith(data) || a.status === 'CANCELADO' || a.status === 'FALTOU') return false;
      const [ah, am] = Formato.hora(a.inicio).split(':').map(Number);
      const [bh, bm] = Formato.hora(a.fim).split(':').map(Number);
      return ah * 60 + am < fim && bh * 60 + bm > ini;
    });
    return choque ? `${choque.clienteNome} já está marcado(a) das ${Formato.hora(choque.inicio)} às ${Formato.hora(choque.fim)}` : null;
  }
}
