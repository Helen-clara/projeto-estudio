import type { EspecialidadeValor, PerfilValor, UsuarioDTO } from '../../shared/dtos';
import { DataTable } from '../components/DataTable.js';
import { FormField, Formulario } from '../components/FormField.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../core/Api.js';
import { h, limpar } from '../core/dom.js';
import { ROTULOS_ESPECIALIDADE, ROTULOS_PERFIL } from '../core/formato.js';
import { botao, seletor, tag } from '../core/ui.js';
import { View } from './View.js';

const SENHA_VALIDA = (v: string): string | null => (v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? null : 'Mínimo 8 caracteres, com letras e números.');

/** Usuários do sistema (somente ADMIN): perfis, reset de senha e ativação. */
export class UsuariosView extends View {
  private tabela!: DataTable<UsuarioDTO>;
  private perfil = '';

  public async render(alvo: HTMLElement): Promise<void> {
    this.tabela = new DataTable<UsuarioDTO>({
      busca: { placeholder: 'Nome, login ou e-mail…' },
      filtros: [seletor('Perfil', [['', 'Todos os perfis'], ['ADMIN', 'Administradores'], ['RECEPCAO', 'Recepção'], ['PROFISSIONAL', 'Profissionais']], this.perfil, (v) => { this.perfil = v; this.tabela.irParaPrimeiraPagina(); })],
      acoes: [h('button', { type: 'button', class: 'btn', onclick: () => this.novo() }, '+ Novo usuário')],
      classeLinha: (u) => (u.ativo ? undefined : 'linha--inativa'),
      carregar: (termo, limit, offset) => Api.chamar(window.api.usuarios.listar({ termo: termo || undefined, perfil: (this.perfil || undefined) as PerfilValor | undefined, ativo: 'todos', limit, offset })),
      colunas: [
        { titulo: 'Usuário', valor: (u) => [h('strong', {}, u.nome), h('span', { class: 'secundario' }, `${u.login} · ${u.email}`)] },
        { titulo: 'Perfil', valor: (u) => h('div', { class: 'chips' }, tag(ROTULOS_PERFIL[u.perfil], u.perfil === 'ADMIN' ? 'vinho' : 'neutra'), u.especialidade ? tag(ROTULOS_ESPECIALIDADE[u.especialidade]) : null) },
        { titulo: 'Último acesso', valor: (u) => (u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca') },
        { titulo: 'Situação', valor: (u) => (u.bloqueado ? tag('bloqueado', 'erro') : u.ativo ? tag('ativo', 'ok') : tag('inativo')) },
        { titulo: 'Ações', valor: (u) => h('div', { class: 'acoes' },
          u.ativo ? botao('Editar', () => this.abrir(u)) : null,
          botao('Resetar senha', () => this.resetarSenha(u)),
          u.ativo
            ? botao('⊘', async () => {
              if (!(await Modal.confirmar('Inativar usuário', `${u.nome} não conseguirá mais entrar no sistema.`, 'Inativar', true))) return;
              await Api.chamar(window.api.usuarios.inativar(u.id)); Toast.sucesso('Usuário inativado.'); await this.tabela.recarregar();
            }, 'btn btn--perigo btn--mini', `Inativar ${u.nome}`)
            : botao('Reativar', async () => { await Api.chamar(window.api.usuarios.reativar(u.id)); Toast.sucesso('Usuário reativado.'); await this.tabela.recarregar(); })) },
      ],
    });
    limpar(alvo);
    alvo.append(h('div', { class: 'pagina' },
      h('p', { class: 'dica' }, 'As senhas são guardadas apenas como hash (bcrypt). O reset de senha também desfaz o bloqueio por tentativas erradas.'),
      this.tabela.elemento));
    await this.tabela.recarregar();
  }

  public novo(): void {
    this.abrir(null);
  }

  private abrir(u: UsuarioDTO | null): void {
    const c: Record<string, FormField> = {
      nome: new FormField({ rotulo: 'Nome completo', obrigatorio: true, largura: 4, valor: u?.nome, maxLength: 120 }),
      login: new FormField({ rotulo: 'Login', obrigatorio: true, largura: 2, valor: u?.login, autocomplete: 'off' }),
      email: new FormField({ rotulo: 'E-mail', tipo: 'email', obrigatorio: true, largura: 3, valor: u?.email }),
      telefone: new FormField({ rotulo: 'Telefone', largura: 3, mascara: 'telefone', valor: u?.telefone }),
      perfil: new FormField({ rotulo: 'Perfil', tipo: 'select', obrigatorio: true, largura: 2, opcoes: [['RECEPCAO', 'Recepção'], ['PROFISSIONAL', 'Profissional'], ['ADMIN', 'Administrador']], valor: u?.perfil ?? 'RECEPCAO' }),
      especialidade: new FormField({ rotulo: 'Especialidade', tipo: 'select', largura: 2, opcoes: [['', '—'], ['TATUADOR', 'Tatuador(a)'], ['ESTETICISTA', 'Esteticista']], valor: u?.especialidade ?? '' }),
      cpf: new FormField({ rotulo: 'CPF', largura: 2, mascara: 'cpf', valor: u?.cpf }),
    };
    if (!u) c.senha = new FormField({ rotulo: 'Senha inicial', tipo: 'senha', obrigatorio: true, largura: 3, autocomplete: 'new-password', validar: SENHA_VALIDA });
    const ajustar = (): void => {
      const prof = c.perfil.valor === 'PROFISSIONAL';
      c.especialidade.desabilitar(!prof);
      if (!prof) c.especialidade.definirValor('');
    };
    c.perfil.aoMudar(ajustar);
    ajustar();
    const f = new Formulario(c);
    Modal.abrir({
      titulo: u ? `Editar ${u.nome}` : 'Novo usuário', tamanho: 'largo', conteudo: f.elemento,
      botoes: [{ texto: 'Salvar', aoClicar: async (m) => {
        if (!f.validar()) return;
        if (c.perfil.valor === 'PROFISSIONAL' && !c.especialidade.valor) { c.especialidade.definirErro('Informe a especialidade.'); return; }
        await Api.chamar(window.api.usuarios.salvar({ id: u?.id, dados: {
          nome: c.nome.valor, login: c.login.valor, email: c.email.valor, telefone: c.telefone.valorOuNulo, cpf: c.cpf.valorOuNulo,
          perfil: c.perfil.valor as PerfilValor, especialidade: (c.especialidade.valor || null) as EspecialidadeValor | null, senha: c.senha?.valor,
        } }));
        m.fechar();
        Toast.sucesso('Usuário salvo.');
        await this.tabela.recarregar();
      } }],
    });
  }

  private resetarSenha(u: UsuarioDTO): void {
    const senha = new FormField({ rotulo: 'Nova senha', tipo: 'senha', obrigatorio: true, largura: 6, autocomplete: 'new-password', validar: SENHA_VALIDA });
    Modal.abrir({
      titulo: `Resetar senha — ${u.login}`, tamanho: 'estreito', conteudo: h('div', { class: 'form' }, senha.elemento),
      botoes: [{ texto: 'Definir senha', aoClicar: async (m) => {
        if (!senha.validar()) return;
        await Api.chamar(window.api.usuarios.resetarSenha({ id: u.id, novaSenha: senha.valor }));
        m.fechar();
        Toast.sucesso(`Senha de ${u.login} redefinida${u.bloqueado ? ' e bloqueio removido' : ''}.`);
        await this.tabela.recarregar();
      } }],
    });
  }
}

