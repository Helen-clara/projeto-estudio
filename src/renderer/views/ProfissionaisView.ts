import type { EspecialidadeValor, ProfissionalDTO } from '../../shared/dtos';
import { DataTable } from '../components/DataTable.js';
import { FormField, Formulario } from '../components/FormField.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato, ROTULOS_ESPECIALIDADE } from '../core/formato.js';
import { botao, seletor, tag } from '../core/ui.js';
import { View } from './View.js';

/** Profissionais (tatuadores e esteticistas) e o vínculo com os serviços que realizam. */
export class ProfissionaisView extends View {
  private tabela!: DataTable<ProfissionalDTO>;
  private especialidade = '';
  private situacao = 'true';

  private get podeGerenciar(): boolean {
    return this.sessao.pode('PROFISSIONAIS_GERENCIAR');
  }

  public async render(alvo: HTMLElement): Promise<void> {
    this.tabela = new DataTable<ProfissionalDTO>({
      busca: { placeholder: 'Nome ou login…' },
      filtros: [
        seletor('Especialidade', [['', 'Todas as especialidades'], ['TATUADOR', 'Tatuadores'], ['ESTETICISTA', 'Esteticistas']], this.especialidade, (v) => { this.especialidade = v; this.tabela.irParaPrimeiraPagina(); }),
        seletor('Situação', [['true', 'Ativos'], ['false', 'Inativos']], this.situacao, (v) => { this.situacao = v; this.tabela.irParaPrimeiraPagina(); }),
      ],
      acoes: this.podeGerenciar ? [h('button', { type: 'button', class: 'btn', onclick: () => this.novo() }, '+ Novo profissional')] : [],
      classeLinha: (p) => (p.ativo ? undefined : 'linha--inativa'),
      carregar: async (termo, limit, offset) => {
        const pagina = await Api.chamar(window.api.profissionais.listar({
          termo: termo || undefined, especialidade: (this.especialidade || undefined) as EspecialidadeValor | undefined, ativo: this.situacao === 'true', limit, offset,
        }));
        // A listagem não traz os serviços: busca os detalhes de cada profissional da página.
        const detalhes = await Promise.all(pagina.items.map((p) => Api.chamar(window.api.profissionais.obter(p.id))));
        return { items: detalhes, total: pagina.total };
      },
      colunas: [
        { titulo: 'Profissional', valor: (p) => h('div', { class: 'pessoa', style: 'margin:0' },
          h('div', { class: 'usuario__avatar' }, Formato.iniciais(p.nome)),
          h('div', {}, h('strong', {}, p.nome), h('span', { class: 'secundario' }, `${p.login} · ${p.email}`))) },
        { titulo: 'Especialidade', valor: (p) => tag(ROTULOS_ESPECIALIDADE[p.especialidade], p.especialidade === 'TATUADOR' ? 'vinho' : 'neutra') },
        { titulo: 'Telefone', valor: (p) => h('span', { class: 'nowrap' }, Formato.telefone(p.telefone)) },
        { titulo: 'Serviços que realiza', valor: (p) => (p.servicos?.length
          ? h('div', { class: 'chips' }, ...p.servicos.map((s) => tag(s.nome)))
          : h('span', { class: 'dica' }, 'nenhum serviço vinculado')) },
        { titulo: 'Ações', largura: '260px', valor: (p) => (this.podeGerenciar ? h('div', { class: 'acoes' },
          p.ativo ? botao('Editar', () => this.abrir(p)) : null,
          p.ativo ? h('button', { type: 'button', class: 'btn btn--sec btn--mini', 'data-acao': 'servicos', onclick: () => void this.servicos(p) }, 'Serviços') : null,
          p.ativo ? botao('Inativar', () => this.inativar(p), 'btn btn--perigo btn--mini')
            : botao('Reativar', async () => { await Api.chamar(window.api.profissionais.reativar(p.id)); Toast.sucesso('Profissional reativado.'); await this.tabela.recarregar(); })) : '—') },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' }, this.tabela.elemento));
    await this.tabela.recarregar();
  }

  public novo(): void {
    if (this.podeGerenciar) this.abrir(null);
  }

  private async inativar(p: ProfissionalDTO): Promise<void> {
    if (!(await Modal.confirmar('Inativar profissional', `Inativar ${p.nome}? Ele(a) não conseguirá mais entrar no sistema.`, 'Inativar', true))) return;
    await Api.chamar(window.api.profissionais.inativar(p.id));
    Toast.sucesso('Profissional inativado.');
    await this.tabela.recarregar();
  }

  private abrir(p: ProfissionalDTO | null): void {
    const campos: Record<string, FormField> = {
      nome: new FormField({ rotulo: 'Nome completo', obrigatorio: true, largura: 4, valor: p?.nome, maxLength: 120 }),
      especialidade: new FormField({ rotulo: 'Especialidade', tipo: 'select', obrigatorio: true, largura: 2, opcoes: [['TATUADOR', 'Tatuador(a)'], ['ESTETICISTA', 'Esteticista']], valor: p?.especialidade ?? 'TATUADOR' }),
      email: new FormField({ rotulo: 'E-mail', tipo: 'email', obrigatorio: true, largura: 3, valor: p?.email }),
      telefone: new FormField({ rotulo: 'Telefone', largura: 3, mascara: 'telefone', valor: p?.telefone }),
      cpf: new FormField({ rotulo: 'CPF', largura: 2, mascara: 'cpf', valor: p?.cpf }),
      login: new FormField({ rotulo: 'Login', obrigatorio: true, largura: 2, valor: p?.login, autocomplete: 'off', validar: (v) => (/^[a-z0-9._-]{3,50}$/i.test(v) ? null : '3 a 50 caracteres: letras, números, ".", "_" ou "-".') }),
    };
    if (!p) {
      campos.senha = new FormField({ rotulo: 'Senha inicial', tipo: 'senha', obrigatorio: true, largura: 2, autocomplete: 'new-password',
        validar: (v) => (v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? null : 'Mínimo 8 caracteres, com letras e números.') });
    }
    const f = new Formulario(campos);
    Modal.abrir({
      titulo: p ? `Editar ${p.nome}` : 'Novo profissional',
      tamanho: 'largo',
      conteudo: [f.elemento, p ? h('p', { class: 'dica' }, 'A senha é alterada pelo próprio profissional (Trocar senha) ou resetada em Usuários.') : null],
      botoes: [{ texto: 'Salvar', aoClicar: async (m) => {
        if (!f.validar()) return;
        const c = f.campos;
        await Api.chamar(window.api.profissionais.salvar({ id: p?.id, dados: {
          nome: c.nome.valor, especialidade: c.especialidade.valor as EspecialidadeValor, email: c.email.valor, telefone: c.telefone.valorOuNulo,
          cpf: c.cpf.valorOuNulo, login: c.login.valor, senha: c.senha?.valor,
        } }));
        m.fechar();
        Toast.sucesso('Profissional salvo.');
        await this.tabela.recarregar();
      } }],
    });
  }

  /** Vínculo N:N: só aparecem serviços compatíveis com a especialidade. */
  private async servicos(p: ProfissionalDTO): Promise<void> {
    const categoria = p.especialidade === 'TATUADOR' ? 'TATUAGEM' : 'ESTETICA';
    const todos = await Api.chamar(window.api.servicos.listar({ categoria, limit: 200 }));
    const marcados = new Set((p.servicos ?? []).map((s) => s.id));
    const caixas = todos.items.map((s) => {
      const cb = h('input', { type: 'checkbox', value: String(s.id) });
      cb.checked = marcados.has(s.id);
      return { cb, el: h('label', { class: 'item-lista', style: 'grid-template-columns:24px 1fr auto;cursor:pointer' }, cb,
        h('span', { class: 'item-lista__info' }, h('span', {}, s.nome), h('small', {}, `${s.duracaoMinutos} min`)), h('span', {}, Formato.moeda(s.preco))) };
    });
    Modal.abrir({
      titulo: `Serviços de ${p.nome}`,
      conteudo: [
        h('p', { class: 'dica' }, `Somente serviços de ${categoria === 'TATUAGEM' ? 'tatuagem' : 'estética'}, compatíveis com a especialidade.`),
        caixas.length ? h('div', { class: 'lista' }, ...caixas.map((c) => c.el)) : h('div', { class: 'vazio' }, 'Nenhum serviço ativo desta categoria.'),
      ],
      botoes: [{ texto: 'Salvar vínculos', aoClicar: async (m) => {
        const ids = caixas.filter((c) => c.cb.checked).map((c) => Number(c.cb.value));
        await Api.chamar(window.api.profissionais.definirServicos({ profissionalId: p.id, servicoIds: ids }));
        m.fechar();
        Toast.sucesso('Serviços atualizados.');
        await this.tabela.recarregar();
      } }],
    });
  }
}
