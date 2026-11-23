import type { ClienteDTO, ClienteInput } from '../../shared/dtos';
import { Abas } from '../components/Abas.js';
import { DataTable } from '../components/DataTable.js';
import { FormField, Formulario } from '../components/FormField.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { Formato } from '../core/formato.js';
import { botao, kpi, seletor, tag } from '../core/ui.js';
import { View } from './View.js';

/** Cadastro de clientes com endereço pelo CEP (ViaCEP) e histórico de atendimentos. */
export class ClientesView extends View {
  private tabela!: DataTable<ClienteDTO>;
  private situacao = 'true';

  private get podeEditar(): boolean {
    return this.sessao.pode('CLIENTES_EDITAR');
  }

  public async render(alvo: HTMLElement): Promise<void> {
    this.tabela = new DataTable<ClienteDTO>({
      busca: { placeholder: 'Nome ou CPF…', rotulo: 'Buscar cliente por nome ou CPF' },
      filtros: [seletor('Situação', [['true', 'Ativos'], ['false', 'Inativos']], this.situacao, (v) => { this.situacao = v; this.tabela.irParaPrimeiraPagina(); })],
      acoes: this.podeEditar ? [h('button', { type: 'button', class: 'btn', onclick: () => this.novo() }, '+ Novo cliente')] : [],
      vazio: 'Nenhum cliente encontrado. Ajuste a busca ou cadastre um novo cliente.',
      classeLinha: (c) => (c.ativo ? undefined : 'linha--inativa'),
      carregar: (termo, limit, offset) => Api.chamar(window.api.clientes.listar({ termo: termo || undefined, ativo: this.situacao === 'true', limit, offset })),
      colunas: [
        { titulo: 'Cliente', valor: (c) => [h('strong', {}, c.nome), c.menorDeIdade ? [' ', tag('menor de idade', 'aviso')] : null, h('span', { class: 'secundario' }, c.email ?? 'sem e-mail')].flat() },
        { titulo: 'CPF', valor: (c) => h('span', { class: 'nowrap' }, Formato.cpf(c.cpf)) },
        { titulo: 'Idade', valor: (c) => `${c.idade} anos`, alinhar: 'direita' },
        { titulo: 'Telefone', valor: (c) => h('span', { class: 'nowrap' }, Formato.telefone(c.telefone)) },
        { titulo: 'Cidade', valor: (c) => (c.endereco?.cidade ? `${c.endereco.cidade}/${c.endereco.uf ?? ''}` : '—') },
        { titulo: 'Ações', largura: '210px', valor: (c) => h('div', { class: 'acoes' },
          botao(this.podeEditar && c.ativo ? 'Abrir' : 'Ver', () => this.abrir(c)),
          this.podeEditar && c.ativo ? botao('Inativar', () => this.inativar(c), 'btn btn--perigo btn--mini') : null,
          this.podeEditar && !c.ativo ? botao('Reativar', async () => {
            await Api.chamar(window.api.clientes.reativar(c.id));
            Toast.sucesso(`${c.nome} reativado(a).`);
            await this.tabela.recarregar();
          }) : null) },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' }, this.tabela.elemento));
    await this.tabela.recarregar();
  }

  public novo(): void {
    if (this.podeEditar) this.abrir(null);
  }

  private async inativar(c: ClienteDTO): Promise<void> {
    const ok = await Modal.confirmar('Inativar cliente', `Inativar ${c.nome}? O cadastro some das listas, mas o histórico de atendimentos é mantido.`, 'Inativar', true);
    if (!ok) return;
    await Api.chamar(window.api.clientes.inativar(c.id));
    Toast.sucesso('Cliente inativado.');
    await this.tabela.recarregar();
  }

  /** Abre o cliente (novo ou existente) com as abas Dados e Histórico. */
  private abrir(c: ClienteDTO | null): void {
    const somenteLeitura = !this.podeEditar || (c !== null && !c.ativo);
    const form = this.formulario(c, somenteLeitura);
    const verHistorico = c !== null && this.sessao.pode('HISTORICO_VER_TODOS', 'HISTORICO_VER_PROPRIOS_CLIENTES');
    const conteudo = verHistorico
      ? new Abas([
        { rotulo: 'Dados', conteudo: () => form.elemento },
        { rotulo: 'Histórico de atendimentos', conteudo: () => this.historico(c as ClienteDTO) },
      ]).elemento
      : form.elemento;

    Modal.abrir({
      titulo: c ? c.nome : 'Novo cliente',
      tamanho: 'largo',
      conteudo,
      botoes: somenteLeitura ? [] : [{
        texto: c ? 'Salvar alterações' : 'Cadastrar cliente',
        aoClicar: async (m) => {
          if (!form.validar()) return;
          const r = await Api.chamar(window.api.clientes.salvar({ id: c?.id, dados: ClientesView.dados(form) }));
          m.fechar();
          Toast.sucesso(c ? 'Cliente atualizado.' : 'Cliente cadastrado.');
          r.avisos.forEach((a) => Toast.aviso(a));
          await this.tabela.recarregar();
        },
      }],
    });
  }

  private formulario(c: ClienteDTO | null, somenteLeitura: boolean): Formulario<Record<string, FormField>> {
    const e = c?.endereco;
    const campos = {
      nome: new FormField({ rotulo: 'Nome completo', obrigatorio: true, largura: 4, valor: c?.nome, maxLength: 120 }),
      cpf: new FormField({ rotulo: 'CPF', obrigatorio: true, largura: 2, mascara: 'cpf', valor: c?.cpf, placeholder: '000.000.000-00' }),
      nascimento: new FormField({ rotulo: 'Data de nascimento', tipo: 'data', obrigatorio: true, largura: 2, valor: c?.dataNascimento, max: Formato.isoData(new Date()) }),
      telefone: new FormField({ rotulo: 'Telefone', largura: 2, mascara: 'telefone', valor: c?.telefone, placeholder: '(11) 99999-9999' }),
      email: new FormField({ rotulo: 'E-mail', tipo: 'email', largura: 2, valor: c?.email, ajuda: 'Usado para os lembretes automáticos.' }),
      cep: new FormField({ rotulo: 'CEP', largura: 2, mascara: 'cep', valor: e?.cep, placeholder: '00000-000', ajuda: 'Digite o CEP para preencher o endereço.' }),
      logradouro: new FormField({ rotulo: 'Logradouro', largura: 4, valor: e?.logradouro, maxLength: 150 }),
      numero: new FormField({ rotulo: 'Número', largura: 1, valor: e?.numero, maxLength: 10 }),
      complemento: new FormField({ rotulo: 'Complemento', largura: 2, valor: e?.complemento, maxLength: 80 }),
      bairro: new FormField({ rotulo: 'Bairro', largura: 3, valor: e?.bairro, maxLength: 80 }),
      cidade: new FormField({ rotulo: 'Cidade', largura: 4, valor: e?.cidade, maxLength: 80 }),
      uf: new FormField({ rotulo: 'UF', largura: 2, valor: e?.uf, maxLength: 2, validar: (v) => (/^[A-Za-z]{2}$/.test(v) ? null : 'Use a sigla (ex.: SP).') }),
      observacoes: new FormField({ rotulo: 'Observações (alergias, preferências…)', tipo: 'textarea', largura: 6, valor: c?.observacoes, maxLength: 2000 }),
    };
    if (somenteLeitura) Object.values(campos).forEach((f) => f.desabilitar(true));
    else this.ligarCep(campos);
    return new Formulario(campos);
  }

  /** Ao completar 8 dígitos, consulta o ViaCEP; sem resultado, libera o preenchimento manual. */
  private ligarCep(c: Record<'cep' | 'logradouro' | 'bairro' | 'cidade' | 'uf' | 'numero', FormField>): void {
    let ultimo = c.cep.valor.replace(/\D/g, '');
    const endereco = [c.logradouro, c.bairro, c.cidade, c.uf];
    c.cep.aoDigitar(() => {
      const cep = c.cep.valor.replace(/\D/g, '');
      if (cep.length !== 8 || cep === ultimo) return;
      ultimo = cep;
      c.cep.definirAjuda('⏳ Consultando ViaCEP…');
      endereco.forEach((f) => f.desabilitar(true));
      Api.chamar(window.api.clientes.buscarCep(cep))
        .then((r) => {
          if (r.encontrado && r.endereco) {
            c.logradouro.definirValor(r.endereco.logradouro ?? '');
            c.bairro.definirValor(r.endereco.bairro ?? '');
            c.cidade.definirValor(r.endereco.cidade ?? '');
            c.uf.definirValor(r.endereco.uf ?? '');
            c.cep.definirAjuda('✔ Endereço preenchido pelo ViaCEP. Informe o número.', 'ok');
            c.numero.focar();
          } else {
            c.cep.definirAjuda(`${r.mensagem ?? 'CEP não encontrado.'}`, 'aviso');
            c.logradouro.focar();
          }
        })
        .catch((e: Error) => c.cep.definirAjuda(`${e.message} Preencha o endereço manualmente.`, 'aviso'))
        .finally(() => endereco.forEach((f) => f.desabilitar(false)));
    });
  }

  private static dados(f: Formulario<Record<string, FormField>>): ClienteInput {
    const c = f.campos;
    const temEndereco = c.cep.valor !== '';
    return {
      nome: c.nome.valor,
      cpf: c.cpf.valor,
      dataNascimento: c.nascimento.valor,
      telefone: c.telefone.valorOuNulo,
      email: c.email.valorOuNulo,
      observacoes: c.observacoes.valorOuNulo,
      endereco: temEndereco ? {
        cep: c.cep.valor, logradouro: c.logradouro.valorOuNulo, numero: c.numero.valorOuNulo, complemento: c.complemento.valorOuNulo,
        bairro: c.bairro.valorOuNulo, cidade: c.cidade.valorOuNulo, uf: c.uf.valorOuNulo?.toUpperCase() ?? null,
      } : null,
    };
  }

  private async historico(c: ClienteDTO): Promise<HTMLElement> {
    const r = await Api.chamar(window.api.historico.porCliente({ clienteId: c.id, limit: 100 }));
    const doProprio = !this.sessao.pode('HISTORICO_VER_TODOS');
    return h('div', { class: 'pagina' },
      h('div', { class: 'kpis' },
        kpi('Atendimentos concluídos', String(r.total), doProprio ? 'realizados por você' : 'todos os profissionais'),
        kpi('Total cobrado', Formato.moeda(r.valorTotal), 'soma dos atendimentos', true)),
      r.items.length === 0
        ? h('div', { class: 'vazio' }, 'Nenhum atendimento concluído ainda.')
        : h('div', { class: 'dt__moldura' }, h('table', { class: 'tabela' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Data'), h('th', {}, 'Procedimento'), h('th', {}, 'Profissional'), h('th', { class: 'num' }, 'Valor'))),
          h('tbody', {}, ...r.items.map((a) => h('tr', {},
            h('td', {}, Formato.dataHora(a.data)), h('td', {}, a.servicoNome), h('td', {}, a.profissionalNome),
            h('td', { class: 'num' }, Formato.moeda(a.valorCobrado))))))));
  }
}
