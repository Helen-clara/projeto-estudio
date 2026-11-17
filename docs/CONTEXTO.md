# Contexto do Projeto: Ink & Glow Studio
**Sistema de Gestão Desktop para Estúdio de Estética e Tatuagem**
**Disciplina:** DAD (Desenvolvimento de Aplicações Desktop)
**Professor:** willcotil

> Este documento é a **fonte oficial** do escopo do projeto. Em caso de divergência com qualquer outro arquivo, vale o que está aqui.

---

## 1. Visão geral

Aplicativo **desktop** em **Electron + TypeScript (POO)** com banco **MySQL** para gerenciar um **estúdio de estética e tatuagem**. Uso interno por administrador, recepção e profissionais. Projeto acadêmico: os requisitos do professor estão em `docs/requisitos.pdf`.

---

## 2. Perfis de usuário (RBAC)

- **ADMIN**: acesso total, usuários, serviços, relatórios, estoque, parâmetros.
- **RECEPCAO**: cadastra clientes, consulta agenda, cria/edita/cancela agendamentos, vê estoque (somente leitura).
- **PROFISSIONAL** (especialidade `TATUADOR` ou `ESTETICISTA`): vê e gerencia a própria agenda, conclui atendimentos, registra consumo de material, vê histórico dos seus clientes.
- Clientes **não** fazem login; são apenas registros.

---

## 3. Funcionalidades

1. **Cadastro de clientes**: nome, CPF, data de nascimento, telefone, e-mail, observações, endereço. Ao digitar o **CEP**, preencher rua, bairro, cidade e UF automaticamente (API ViaCEP).
2. **Cadastro de profissionais** (são usuários com perfil PROFISSIONAL): dados pessoais, especialidade, login/senha (hash bcryptjs), ativo/inativo.
3. **Cadastro de procedimentos/serviços** (ex.: tatuagem fine line, limpeza de pele, peeling): nome, categoria (TATUAGEM/ESTETICA), duração em minutos, preço em BRL, ativo. Vínculo N:N entre profissionais e serviços que cada um realiza.
4. **Agenda por profissional**: criar, editar, cancelar e concluir agendamentos (cliente + profissional + serviço + data/hora início/fim + status `AGENDADO|CONFIRMADO|CONCLUIDO|CANCELADO|FALTOU`). Não permitir conflito de horário do mesmo profissional. Avisar se a data for **feriado nacional** (API BrasilAPI).
5. **Histórico de atendimentos**: guardar quais procedimentos foram feitos, quando, por quem e valor cobrado. Consultas por cliente, por profissional e por período. Estrutura pensada para **estatísticas futuras** (consultas agregadas: atendimentos por mês, por serviço, por profissional, faturamento).
6. **Estoque de materiais** (tintas, agulhas, luvas, séruns, etc.): nome, categoria (TATUAGEM/ESTETICA), unidade, quantidade atual, estoque mínimo, preço de custo em **USD e BRL** (conversão pela cotação do dia, API AwesomeAPI), fornecedor. Movimentações de entrada e saída (saída pode estar ligada a um agendamento). Alerta de estoque baixo.
7. **Lembretes automáticos**: **um dia antes** do agendamento, o sistema envia lembrete ao cliente (e-mail via Nodemailer/SMTP configurável em `.env`) e registra o envio. Mensagem inclui data, hora, profissional, procedimento e uma dica de cuidado conforme a previsão do tempo do dia (API Open-Meteo). Se o app estiver aberto, um agendador (`node-cron`) verifica periodicamente; ao abrir o app, roda também uma verificação de pendências.

---

## 4. APIs externas (4, todas com uso real)

1. **ViaCEP** — endereço do cliente pelo CEP.
2. **AwesomeAPI (cotação)** — USD→BRL para o estoque.
3. **BrasilAPI (feriados nacionais)** — validação na agenda.
4. **Open-Meteo** — previsão do tempo para dica no lembrete.

Todas devem ter classe tipada, timeout, tratamento de erro e fallback (o sistema não pode travar se a API cair).

---

## 5. Banco de dados MySQL (8 tabelas relacionadas)

`usuarios`, `clientes`, `servicos`, `profissional_servicos` (N:N), `agendamentos`, `materiais`, `movimentacoes_estoque`, `lembretes`.

Relações:
- `agendamentos` → `clientes`, `usuarios` (profissional), `servicos`;
- `profissional_servicos` → `usuarios`, `servicos`;
- `movimentacoes_estoque` → `materiais` (e opcionalmente `agendamentos`);
- `lembretes` → `agendamentos`.

Todas com chaves estrangeiras, índices e `created_at/updated_at`. Exclusão lógica (`ativo`) em vez de apagar registros com histórico.

---

## 6. Arquitetura (POO em TypeScript estrito)

```
src/
  main/
    main.ts                 (cria a janela, registra IPC)
    config/                 (leitura do .env)
    core/
      database/             (Database.ts, BaseRepository.ts)
      entities/             (classes de domínio)
      repositories/         (acesso ao MySQL, SQL parametrizado)
      services/             (regras de negócio)
      security/             (AuthService, SessionManager, permissões)
      validators/           (CPF, e-mail, telefone, CEP)
    integrations/           (ViaCepClient, CotacaoClient, FeriadosClient, ClimaClient)
    ipc/                    (handlers por módulo)
  preload/                  (preload.ts, contextBridge, API tipada)
  renderer/                 (HTML/CSS/TS das telas: views/, components/, styles/, assets/)
  shared/                   (tipos, enums e DTOs compartilhados)
database/                   (schema.sql, seed.sql)
scripts/                    (initDb.ts, checkDb.ts, testes manuais)
docs/                       (CONTEXTO.md, CHECKLIST_REQUISITOS.md, requisitos.pdf)
```

Fluxo de camadas: **Renderer → (IPC) → Handler → Service → Repository → MySQL**.

---

## 7. Regras técnicas obrigatórias

- TypeScript `strict: true`, sem `any` sem justificativa, **sem arquivos .js escritos à mão** (apenas saída de build em `dist/`).
- Orientação a objetos: classes, encapsulamento, herança (`BaseRepository`), interfaces e injeção de dependência simples via construtor.
- Camadas: Renderer → (IPC) → Handler → Service → Repository → MySQL. O renderer **nunca** acessa o banco.
- Electron seguro: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` quando possível, apenas API mínima exposta no preload.
- SQL somente com **prepared statements** (mysql2). Senhas com **bcryptjs**. Dados pessoais tratados com cuidado (LGPD): não logar CPF/senha.
- Credenciais só em `.env` (nunca no Git); manter `.env.example`.
- Mensagens e interface em **português do Brasil**; código (classes/métodos) em inglês ou português, mas **consistente**.
- Visual: tema escuro e limpo, adequado a estúdio de tatuagem/estética.

---

## 8. Regras de Git (avaliação do professor)

- Branch por prompt: `feat/<modulo>`; commits pequenos e frequentes em português no padrão `tipo(escopo): descrição` (ex.: `feat(clientes): adiciona consulta de CEP`).
- Nunca commitar `node_modules`, `dist`, `.env`.
- Cada membro commita com a **própria** identidade git (`user.name`/`user.email`).
- No fim: rodar `npm run build`, corrigir erros e abrir Pull Request para `main`.

---

## 9. Divisão do projeto em 8 partes (4 integrantes)

A **Parte 0** (alinhamento da base) precede as demais e deve ser mergeada antes de qualquer outra branch.

| Parte | Módulo | Foco do desenvolvimento |
| :---: | :--- | :--- |
| **Parte 0** | Alinhamento da base | Documentação oficial, dependências, `.env.example`, estrutura de pastas e tipos compartilhados. |
| **Parte 1** | Configuração inicial & infraestrutura | Git, compilação TS, Electron base, preload seguro e tema escuro (já entregue). |
| **Parte 2** | Banco de dados MySQL | `schema.sql` com as 8 tabelas, `seed.sql`, `Database` (Singleton) e `BaseRepository`, scripts `db:init`/`db:check`. |
| **Parte 3** | Domínio & repositories (POO) | Entidades e repositories tipados com prepared statements para todas as tabelas. |
| **Parte 4** | Serviços, segurança & validação | Services com regras de negócio, `AuthService`/`SessionManager`, RBAC, bcryptjs, validadores (CPF, e-mail, telefone, CEP), `docs/SEGURANCA.md`. |
| **Parte 5** | Integrações com as 4 APIs | `ViaCepClient`, `CotacaoClient`, `FeriadosClient`, `ClimaClient` com timeout e fallback. |
| **Parte 6** | Camada IPC & lembretes | Handlers IPC por módulo, API tipada no preload, agendador `node-cron` + Nodemailer. |
| **Parte 7** | Interface desktop & CRUDs | Telas em tema escuro para todas as entidades, formulários, filtros e feedback. |
| **Parte 8** | Auditoria, testes & entrega | Conferência do checklist, tratamento global de erros, documentação final. |

A atribuição de cada parte aos membros está nos arquivos de prompt de cada integrante.
