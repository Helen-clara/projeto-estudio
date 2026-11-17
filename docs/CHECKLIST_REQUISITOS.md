# Checklist de Requisitos Obrigatórios do Projeto
**Disciplina:** DAD (Desenvolvimento de Aplicações Desktop)
**Professor Avaliador:** willcotil
**Documento Base:** `docs/requisitos.pdf`
**Escopo oficial:** `docs/CONTEXTO.md`

Este checklist reúne todos os requisitos técnicos mínimos e critérios de avaliação do projeto final.

---

## 1. Requisitos Técnicos Obrigatórios

- [ ] **1. Banco de Dados Relacional (Mínimo de 6 Tabelas Relacionadas):**
  - [ ] Modelagem de banco de dados relacional.
  - [ ] No mínimo 6 tabelas com relacionamentos reais via chaves estrangeiras (FKs).
  - [ ] Sem tabelas soltas ou desconexas.
  - *No projeto Ink & Glow:* 8 tabelas planejadas (`usuarios`, `clientes`, `servicos`, `profissional_servicos`, `agendamentos`, `materiais`, `movimentacoes_estoque`, `lembretes`), com `created_at/updated_at` e exclusão lógica (`ativo`).

- [ ] **2. CRUD Completo para Todas as Entidades:**
  - [ ] Create (criação).
  - [ ] Read (consulta com filtros/listagem).
  - [ ] Update (edição).
  - [ ] Delete (exclusão lógica consistente via `ativo`).
  - [ ] Aplicado a **todas** as entidades do sistema, não apenas à principal: usuários/profissionais, clientes, serviços, vínculos profissional↔serviço, agendamentos, materiais, movimentações de estoque e lembretes.

- [ ] **3. Consumo de APIs em 4 Situações Distintas:**
  - [ ] Consumo de dados de API em pelo menos 4 situações distintas dentro do fluxo.
  - [ ] Fontes/finalidades genuinamente diferentes entre si.
  - [ ] Propósito real no domínio do sistema (não apenas para cumprir requisito).
  - [ ] Cada cliente de API com classe tipada, timeout, tratamento de erro e fallback.
  - *No projeto Ink & Glow:*
    1. **ViaCEP:** preenchimento automático do endereço do cliente pelo CEP.
    2. **AwesomeAPI (cotação):** conversão USD→BRL do preço de custo dos materiais no estoque.
    3. **BrasilAPI (feriados nacionais):** aviso de feriado ao criar/editar agendamentos.
    4. **Open-Meteo:** previsão do tempo para a dica de cuidado no lembrete enviado ao cliente.

- [ ] **4. Segurança:**
  - [ ] Senhas nunca armazenadas em texto puro (hash com `bcryptjs`).
  - [ ] SQL somente com prepared statements (`mysql2`).
  - [ ] Validação rigorosa de dados de entrada em todas as camadas.
  - [ ] Controle de acesso por perfis (RBAC: `ADMIN`, `RECEPCAO`, `PROFISSIONAL` com especialidade `TATUADOR`/`ESTETICISTA`).
  - [ ] Proteção de dados pessoais (LGPD): não logar CPF/senha; credenciais só em `.env`.
  - [ ] Electron seguro (`contextIsolation: true`, `nodeIntegration: false`, `sandbox` quando possível).
  - [ ] **`docs/SEGURANCA.md` com justificativa das decisões de segurança.**

- [ ] **5. Código Modularizado em Classes (POO):**
  - [ ] Lógica de negócio organizada em classes (Programação Orientada a Objetos).
  - [ ] Separação clara de responsabilidades: Entidades, Repositories (herdando `BaseRepository`), Services, Security, Validators, Integrations e IPC Handlers.
  - [ ] Injeção de dependência simples via construtor; ausência de funções soltas na lógica central.

- [ ] **6. Aplicação Desktop em Electron com TypeScript:**
  - [ ] Estrutura desktop nativa com Electron.
  - [ ] TypeScript (`strict: true`) em toda a lógica (Main, Preload, Renderer, Shared e scripts).
  - [ ] **Nenhum arquivo `.js` escrito à mão** (apenas saída de build em `dist/`).
  - [ ] Arquitetura segura de IPC (renderer nunca acessa o banco).

- [ ] **7. Funcionalidades do Escopo:**
  - [ ] Lembretes por e-mail (Nodemailer/SMTP) um dia antes do agendamento, com registro do envio e agendador `node-cron`.
  - [ ] Alerta de estoque baixo e movimentações de entrada/saída.
  - [ ] Bloqueio de conflito de horário do mesmo profissional.
  - [ ] Histórico de atendimentos com consultas por cliente, profissional e período.

---

## 2. Recomendações sobre o Uso de IA Generativa

- [ ] Utilização estruturada de IA para arquitetar o projeto antes de codar.
- [ ] Criação de agentes especializados e skills reutilizáveis para tarefas recorrentes.
- [ ] Domínio e capacidade do grupo de explicar todas as decisões tomadas e o código gerado.
- [ ] Avaliação de MCP / RAG caso necessário para integrações ou consulta a documentos de domínio.

---

## 3. Critérios de Entrega e Versionamento no GitHub

- [ ] Repositório oficial no GitHub do grupo.
- [ ] Usuário **`willcotil`** adicionado como colaborador do repositório desde o início.
- [ ] Histórico de commits contínuo e incremental ao longo de todo o desenvolvimento (não entregar tudo em commit único).
- [ ] Commits próprios e identificáveis de **todos os 4 integrantes** do grupo no histórico do Git.
- [ ] Commits em português no padrão `tipo(escopo): descrição`, uma branch `feat/<modulo>` por parte e Pull Request para `main`.
