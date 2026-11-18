# Decisões de Segurança — Ink & Glow Studio

Este documento justifica as decisões de segurança do sistema, como pede o requisito 4 do professor (`docs/requisitos.pdf`).
Contexto: aplicativo **desktop** de uso interno, que guarda **dados pessoais de clientes** (CPF, nascimento, telefone, endereço) e controla agenda, estoque e faturamento do estúdio.

## Resumo

| Risco | Decisão | Onde |
| :--- | :--- | :--- |
| Vazamento de senhas | Hash **bcryptjs** (custo 10, salt aleatório) | `services/SenhaHasher.ts` |
| Adivinhação de senha | Bloqueio de 15 min após **5 tentativas** erradas | `services/AuthService.ts`, `UsuarioRepository.registrarFalhaLogin` |
| Descobrir quais logins existem | Mensagem genérica + tempo de resposta igual | `AuthService.login` |
| SQL Injection | **Prepared statements** (mysql2) e whitelist de colunas | `core/database/*`, `repositories/*` |
| Código do site/renderer acessando Node ou o banco | `contextIsolation`, `nodeIntegration: false`, `sandbox`, preload mínimo, CSP | `main.ts`, `preload/preload.ts`, `login.html` |
| Usuário fazendo o que o perfil não permite | **RBAC** checado no processo main antes de cada handler | `core/security/*`, `docs/permissoes.md` |
| Sessão esquecida aberta | Expiração por inatividade (30 min) | `security/SessionManager.ts` |
| Dados pessoais expostos (LGPD) | Mínimo necessário, sem CPF/senha em logs, exclusão lógica | entidades, `IpcRegistrar` |
| Credenciais no repositório | Só no `.env` (no `.gitignore`), com `.env.example` | raiz |

## 1. Senhas com bcryptjs

- **Nunca** guardamos a senha, só o hash bcrypt (`usuarios.senha_hash`). Cada hash tem salt próprio, então duas senhas iguais geram hashes diferentes e tabelas pré-calculadas (*rainbow tables*) não funcionam.
- O bcrypt é **lento de propósito** (custo 10 ≈ 2¹⁰ rodadas): um atacante com uma cópia do banco testa poucas senhas por segundo. Funções rápidas como MD5/SHA-256 puras permitiriam bilhões de testes.
- Usamos **bcryptjs** (JavaScript puro) em vez de `bcrypt` (nativo): não exige compilação no Windows nem recompilar para a versão do Electron.
- **Política de senha** para senhas novas: 8 a 72 caracteres, com letras e números (`PoliticaSenha`). O limite de 72 é porque o bcrypt ignora o que passa disso.
- O hash **nunca sai do processo main**: as consultas comuns de usuários e profissionais não selecionam `senha_hash`; só `findCredenciaisPorLogin`/`findSenhaHash` leem o hash, para comparar.
- A troca de senha exige a **senha atual**. O reset (esqueci a senha) é só do ADMIN e também libera o bloqueio.

## 2. Proteção do login

- **Bloqueio temporário:** 5 senhas erradas seguidas bloqueiam o usuário por 15 minutos. O contador e o bloqueio são atualizados num único `UPDATE` (atômico) e o tempo é calculado pelo próprio MySQL (`NOW()`), sem depender do relógio/fuso do computador.
- **Mensagem genérica:** login inexistente, senha errada e usuário inativo respondem igual: *"Usuário ou senha inválidos."*. Assim não dá para descobrir quais logins existem.
- **Mesmo tempo de resposta:** quando o login não existe, a senha é comparada mesmo assim com um hash fictício, para que a resposta não seja mais rápida (ataque de tempo).
- Exceção consciente: o aviso de bloqueio informa os minutos restantes. Isso revela que o login existe, mas só depois de 5 tentativas, e evita que a pessoa legítima pense que esqueceu a senha. Para um sistema interno, consideramos o ganho de usabilidade maior que o risco.
- `ultimo_acesso` é registrado em cada login bem-sucedido (auditoria básica).

## 3. SQL somente com prepared statements

- Toda consulta usa `pool.execute(sql, params)` do **mysql2**: o SQL vai para o servidor com `?` e os valores são enviados separados. Um valor como `' OR 1=1 --` é tratado como texto, nunca como comando.
- Nomes de tabela/coluna não podem ser parâmetros. Por isso eles só vêm de **listas fixas no código**: a `BaseRepository` valida os identificadores por regex e aceita gravar/ordenar só colunas declaradas pela subclasse.
- Termos de busca em `LIKE` têm `%`, `_` e `\` escapados (`SqlFiltros.like`), para que o usuário não consiga montar curingas.
- O pool usa `multipleStatements: false`: mesmo com um erro de programação, não é possível empilhar um segundo comando (`; DROP TABLE ...`).

## 4. Electron seguro

- **`contextIsolation: true`**: o JavaScript da tela roda num mundo separado do preload, então não alcança objetos internos do Electron/Node.
- **`nodeIntegration: false`** e **`sandbox: true`**: a tela não tem `require`, `fs`, `child_process` etc. Se um texto malicioso virar script (XSS), ele não consegue ler arquivos nem executar programas.
- **Preload mínimo:** expõe só `window.api` com métodos de negócio (`clientes.listar`, `auth.login`...), cada um ligado a um canal IPC **fixo**. Não expõe `ipcRenderer` genérico. O preload só importa tipos, então funciona dentro do sandbox.
- **O renderer nunca acessa o banco:** caminho obrigatório Renderer → IPC → Handler → Service → Repository → MySQL. Credenciais do banco ficam só no processo main.
- **Content-Security-Policy** na tela de login (`default-src 'self'`): bloqueia scripts e estilos externos ou embutidos no HTML.
- A tela usa `textContent` (nunca `innerHTML`) para mostrar mensagens, evitando injeção de HTML.

## 5. Controle de acesso (RBAC)

- Perfis **ADMIN**, **RECEPCAO** e **PROFISSIONAL**, com permissões definidas em `Permissao.ts` a partir do CONTEXTO.md. Matriz completa em [permissoes.md](permissoes.md).
- A checagem é feita **no processo main** pelo middleware `IpcGuard`, antes de executar qualquer handler. Esconder botões na tela é só conveniência: chamar o canal diretamente pelo DevTools também é barrado.
- Sem sessão → `UnauthorizedError`; sem permissão → `ForbiddenError`.
- **Menor privilégio:** cada perfil tem só o necessário (recepção vê estoque, mas não altera; profissional não gerencia usuários etc.).
- Proteções contra se trancar fora do sistema: o ADMIN não pode se inativar nem tirar o próprio perfil, e sempre existe pelo menos um ADMIN ativo.

## 6. Sessão

- A sessão fica **na memória do processo main** (`SessionManager`, Singleton), não no renderer nem em arquivo; fechar o app encerra a sessão.
- Guarda só id, nome, login, perfil e especialidade — **nunca senha ou hash**.
- Expira após **30 minutos sem atividade** (configurável por `SESSAO_TIMEOUT_MINUTOS` no `.env`); cada chamada autorizada renova o prazo.

## 7. Validação em todas as camadas

| Camada | O que valida |
| :--- | :--- |
| Tela | Campos obrigatórios e formato básico (experiência do usuário). |
| IPC (`IpcEntrada`) | Tipo e tamanho de cada campo vindo do renderer (dado não confiável); campos desconhecidos são descartados. |
| Entidades | Regras de conteúdo: CPF com dígitos verificadores, e-mail, telefone, CEP, datas, valores. |
| Services | Regras de negócio: unicidade, perfil × especialidade, bloqueios de inativação. |
| Banco | `UNIQUE`, `FOREIGN KEY`, `CHECK` e `ENUM` como última barreira. |

## 8. LGPD e dados pessoais

- **Finalidade e mínimo necessário:** guardamos só os dados usados pelo estúdio (contato, endereço para cadastro, nascimento para a regra de maioridade da tatuagem).
- **Sem dados pessoais em logs:** o `IpcRegistrar` não registra o conteúdo das requisições; erros inesperados aparecem no console só com o código/mensagem técnica, e o renderer recebe uma mensagem genérica.
- **Exclusão lógica (`ativo`)**: preserva o histórico de atendimentos (necessário para o negócio e para a contabilidade) sem exibir o registro nas listagens.
- **Acesso restrito por perfil:** cada perfil vê só o que precisa.

## 9. Segredos e configuração

- Credenciais (banco, SMTP) ficam **apenas no `.env`**, que está no `.gitignore`. O repositório tem só o `.env.example`, sem valores reais.
- As senhas do `seed.sql` são **apenas para desenvolvimento** e devem ser trocadas em uso real.

## Limitações conhecidas

- O arquivo `.env` fica em texto no computador; quem tem acesso ao Windows do estúdio consegue lê-lo. Em produção, usar um usuário MySQL com permissões mínimas e o disco protegido pelo login do Windows.
- A conexão com o MySQL não usa TLS por padrão; em servidor remoto, recomenda-se habilitar SSL no mysql2.
- O bloqueio de login é por usuário (não por máquina); como o app é interno, consideramos suficiente.
