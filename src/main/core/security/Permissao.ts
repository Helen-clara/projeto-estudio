import type { PerfilValor } from '../../../shared/dtos';

/**
 * Ações controladas por perfil (RBAC). Matriz completa e justificativa em docs/permissoes.md.
 * Permissões de módulos ainda não implementados (agenda, estoque, relatórios) já
 * existem para que esses módulos só precisem usá-las.
 */
export enum Permissao {
  // Clientes
  CLIENTES_VER = 'CLIENTES_VER',
  CLIENTES_EDITAR = 'CLIENTES_EDITAR',
  // Serviços
  SERVICOS_VER = 'SERVICOS_VER',
  SERVICOS_EDITAR = 'SERVICOS_EDITAR',
  // Profissionais e vínculos com serviços
  PROFISSIONAIS_VER = 'PROFISSIONAIS_VER',
  PROFISSIONAIS_GERENCIAR = 'PROFISSIONAIS_GERENCIAR',
  // Usuários do sistema
  USUARIOS_GERENCIAR = 'USUARIOS_GERENCIAR',
  // Agenda
  AGENDA_VER_TODOS = 'AGENDA_VER_TODOS',
  AGENDA_VER_PROPRIA = 'AGENDA_VER_PROPRIA',
  AGENDA_EDITAR = 'AGENDA_EDITAR',
  AGENDA_GERENCIAR_PROPRIA = 'AGENDA_GERENCIAR_PROPRIA',
  ATENDIMENTO_CONCLUIR = 'ATENDIMENTO_CONCLUIR',
  HISTORICO_VER_TODOS = 'HISTORICO_VER_TODOS',
  HISTORICO_VER_PROPRIOS_CLIENTES = 'HISTORICO_VER_PROPRIOS_CLIENTES',
  // Estoque
  ESTOQUE_VER = 'ESTOQUE_VER',
  ESTOQUE_EDITAR = 'ESTOQUE_EDITAR',
  ESTOQUE_REGISTRAR_CONSUMO = 'ESTOQUE_REGISTRAR_CONSUMO',
  // Gestão
  RELATORIOS_VER = 'RELATORIOS_VER',
  LEMBRETES_GERENCIAR = 'LEMBRETES_GERENCIAR',
  PARAMETROS_EDITAR = 'PARAMETROS_EDITAR',
}

const TODAS = Object.values(Permissao) as Permissao[];

/** Perfil → permissões, conforme docs/CONTEXTO.md (seção Perfis de usuário). */
export const PERMISSOES_POR_PERFIL: Readonly<Record<PerfilValor, ReadonlySet<Permissao>>> = {
  // Acesso total.
  ADMIN: new Set(TODAS),

  // Cadastra clientes, consulta agenda, cria/edita/cancela agendamentos, vê estoque (somente leitura).
  RECEPCAO: new Set([
    Permissao.CLIENTES_VER,
    Permissao.CLIENTES_EDITAR,
    Permissao.SERVICOS_VER,
    Permissao.PROFISSIONAIS_VER,
    Permissao.AGENDA_VER_TODOS,
    Permissao.AGENDA_EDITAR,
    Permissao.HISTORICO_VER_TODOS,
    Permissao.ESTOQUE_VER,
  ]),

  // Própria agenda, conclui atendimentos, registra consumo de material, histórico dos seus clientes.
  PROFISSIONAL: new Set([
    Permissao.CLIENTES_VER,
    Permissao.SERVICOS_VER,
    Permissao.PROFISSIONAIS_VER,
    Permissao.AGENDA_VER_PROPRIA,
    Permissao.AGENDA_GERENCIAR_PROPRIA,
    Permissao.ATENDIMENTO_CONCLUIR,
    Permissao.HISTORICO_VER_PROPRIOS_CLIENTES,
    Permissao.ESTOQUE_VER,
    Permissao.ESTOQUE_REGISTRAR_CONSUMO,
  ]),
};

export function permissoesDoPerfil(perfil: PerfilValor): Permissao[] {
  return [...(PERMISSOES_POR_PERFIL[perfil] ?? [])];
}
