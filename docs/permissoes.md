# Permissões (RBAC) — Perfil × Ação

Fonte do código: [`src/main/core/security/Permissao.ts`](../src/main/core/security/Permissao.ts).
Base: seção "Perfis de usuário" de [CONTEXTO.md](CONTEXTO.md).

## Como funciona

1. O login (`auth:login`) cria a sessão no processo main (`SessionManager`). A sessão expira após **30 min sem atividade** (`SESSAO_TIMEOUT_MINUTOS` no `.env`).
2. Todo canal IPC, exceto `auth:login`, `auth:logout` e `auth:usuarioAtual`, é registrado com o middleware `IpcGuard`, que **antes de executar** confere:
   - se há sessão válida, senão responde `Sessão expirada ou não iniciada` (`UnauthorizedError`);
   - se o perfil tem a permissão do canal, senão responde `Você não tem permissão para esta ação` (`ForbiddenError`).
3. A checagem é feita **no main**. O renderer recebe a lista `permissoes` em `auth:usuarioAtual` só para esconder botões; esconder na tela não substitui a checagem.

Uso em um handler novo:

```ts
ipc.handle('agenda:criar', guard.exigir(Permissao.AGENDA_EDITAR, (payload, usuario) => service.criar(...)));
// mais de uma permissão aceita:
ipc.handle('agenda:listar', guard.exigirAlguma([Permissao.AGENDA_VER_TODOS, Permissao.AGENDA_VER_PROPRIA], ...));
```

## Matriz de permissões

✔ = permitido · — = negado

| Permissão | ADMIN | RECEPCAO | PROFISSIONAL | Observação |
| :--- | :---: | :---: | :---: | :--- |
| `CLIENTES_VER` | ✔ | ✔ | ✔ | Profissional vê clientes para consultar o histórico dos seus atendimentos. |
| `CLIENTES_EDITAR` | ✔ | ✔ | — | Criar, editar, inativar/reativar e consultar CEP. |
| `SERVICOS_VER` | ✔ | ✔ | ✔ | |
| `SERVICOS_EDITAR` | ✔ | — | — | Catálogo e preços. |
| `PROFISSIONAIS_VER` | ✔ | ✔ | ✔ | Necessário para montar a agenda. |
| `PROFISSIONAIS_GERENCIAR` | ✔ | — | — | Cadastro e vínculo com serviços. |
| `USUARIOS_GERENCIAR` | ✔ | — | — | Criar, editar, inativar e resetar senha de usuários. |
| `AGENDA_VER_TODOS` | ✔ | ✔ | — | |
| `AGENDA_VER_PROPRIA` | ✔ | — | ✔ | Profissional vê apenas a própria agenda. |
| `AGENDA_EDITAR` | ✔ | ✔ | — | Criar, editar e cancelar agendamentos de qualquer profissional. |
| `AGENDA_GERENCIAR_PROPRIA` | ✔ | — | ✔ | Gerenciar os próprios horários. |
| `ATENDIMENTO_CONCLUIR` | ✔ | — | ✔ | Concluir atendimento e informar valor cobrado. |
| `HISTORICO_VER_TODOS` | ✔ | ✔ | — | |
| `HISTORICO_VER_PROPRIOS_CLIENTES` | ✔ | — | ✔ | Filtrado pelo id do profissional logado. |
| `ESTOQUE_VER` | ✔ | ✔ | ✔ | Recepção: somente leitura. |
| `ESTOQUE_EDITAR` | ✔ | — | — | Materiais, entradas e ajustes. |
| `ESTOQUE_REGISTRAR_CONSUMO` | ✔ | — | ✔ | Saída ligada a um atendimento. |
| `RELATORIOS_VER` | ✔ | — | — | Estatísticas e faturamento. |
| `LEMBRETES_GERENCIAR` | ✔ | — | — | Reenviar e consultar lembretes. |
| `PARAMETROS_EDITAR` | ✔ | — | — | Configurações do estúdio. |

## Canais IPC já protegidos

| Canal | Permissão exigida |
| :--- | :--- |
| `auth:login`, `auth:logout`, `auth:usuarioAtual` | Livre (não exige sessão) |
| `auth:trocarSenha` | Sessão válida (qualquer perfil) |
| `usuarios:listar`, `obter`, `salvar`, `inativar`, `reativar`, `resetarSenha` | `USUARIOS_GERENCIAR` |
| `clientes:listar`, `clientes:obter` | `CLIENTES_VER` |
| `clientes:salvar`, `inativar`, `reativar`, `buscarCep` | `CLIENTES_EDITAR` |
| `servicos:listar`, `servicos:obter` | `SERVICOS_VER` |
| `servicos:salvar`, `inativar`, `reativar` | `SERVICOS_EDITAR` |
| `profissionais:listar`, `obter`, `listarServicos` | `PROFISSIONAIS_VER` |
| `profissionais:salvar`, `inativar`, `reativar`, `vincularServico`, `desvincularServico`, `definirServicos` | `PROFISSIONAIS_GERENCIAR` |

## Módulos ainda não implementados

Os módulos abaixo devem usar o `IpcGuard` com estas permissões quando forem criados:

| Módulo | Ação | Permissão |
| :--- | :--- | :--- |
| Agenda | Listar todos os agendamentos | `AGENDA_VER_TODOS` |
| Agenda | Listar a própria agenda (filtrar por `usuario.id`) | `AGENDA_VER_PROPRIA` |
| Agenda | Criar / editar / cancelar qualquer agendamento | `AGENDA_EDITAR` |
| Agenda | Editar / cancelar o próprio agendamento (conferir `profissional_id === usuario.id`) | `AGENDA_GERENCIAR_PROPRIA` |
| Agenda | Concluir atendimento | `ATENDIMENTO_CONCLUIR` |
| Histórico | Por cliente / profissional / período | `HISTORICO_VER_TODOS` ou `HISTORICO_VER_PROPRIOS_CLIENTES` |
| Estoque | Listar materiais, ver alerta de estoque baixo | `ESTOQUE_VER` |
| Estoque | Cadastrar/editar materiais, registrar entrada | `ESTOQUE_EDITAR` |
| Estoque | Registrar saída ligada a um atendimento | `ESTOQUE_REGISTRAR_CONSUMO` |
| Lembretes | Consultar e reenviar | `LEMBRETES_GERENCIAR` |
| Relatórios | Estatísticas e faturamento | `RELATORIOS_VER` |

Regras de propriedade ("própria agenda", "seus clientes") não cabem só no RBAC: o handler recebe o `usuario` logado do `IpcGuard` e o service deve filtrar ou conferir pelo `usuario.id`.

## Regras extras do cadastro de usuários

- O ADMIN não pode inativar a si mesmo nem remover o próprio perfil de ADMIN.
- O sistema sempre mantém pelo menos um ADMIN ativo.
- Profissional com agendamentos futuros não pode ser inativado nem mudar de perfil.
