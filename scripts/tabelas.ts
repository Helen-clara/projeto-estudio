/**
 * As 8 tabelas do projeto, em ordem de criação (pais antes dos filhos).
 * Lista fixa usada pelos scripts de banco; nunca vem de entrada do usuário.
 */
export const TABELAS = [
  'usuarios',
  'clientes',
  'servicos',
  'profissional_servicos',
  'agendamentos',
  'materiais',
  'movimentacoes_estoque',
  'lembretes',
] as const;

export type Tabela = (typeof TABELAS)[number];

/** Mensagem amigável para erros comuns de conexão (sem expor senha). */
export function descreverErroMysql(error: unknown): string {
  const e = error as { code?: string; message?: string };
  switch (e.code) {
    case 'ECONNREFUSED':
      return 'Conexão recusada: confira DB_HOST/DB_PORT e se o MySQL está rodando.';
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
      return 'Servidor MySQL não encontrado ou sem resposta: confira DB_HOST e a rede.';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Acesso negado: confira DB_USER e DB_PASSWORD no .env.';
    case 'ER_DBACCESS_DENIED_ERROR':
      return 'Usuário sem permissão neste banco: confira DB_NAME (em servidores compartilhados costuma ser igual ao usuário).';
    default:
      return e.message ?? String(error);
  }
}
