# Checklist de Requisitos Obrigatórios do Projeto
**Disciplina:** DAD (Desenvolvimento de Aplicações Desktop)  
**Professor Avaliador:** willcotil  
**Documento Base:** `docs/requisitos.pdf`  

Este checklist reúne todos os requisitos técnicos mínimos e critérios de avaliação do projeto final.

---

## 1. Requisitos Técnicos Obrigatórios

- [ ] **1. Banco de Dados Relacional (Mínimo de 6 Tabelas Relacionadas):**
  - [ ] Modelagem de banco de dados relacional.
  - [ ] No mínimo 6 tabelas com relacionamentos reais via chaves estrangeiras (FKs).
  - [ ] Sem tabelas soltas ou desconexas.
  - *No projeto Ink & Glow:* 7 tabelas planejadas (`usuarios`, `clientes`, `anamneses`, `servicos`, `agendamentos`, `pagamentos`, `referencias_visuais`).

- [ ] **2. CRUD Completo para Todas as Entidades:**
  - [ ] Create (criação).
  - [ ] Read (consulta com filtros/listagem).
  - [ ] Update (edição).
  - [ ] Delete (exclusão física ou lógica consistente).
  - [ ] Aplicado a todas as entidades do sistema, não apenas à principal.

- [ ] **3. Consumo de APIs em 4 Situações Distintas:**
  - [ ] Consumo de dados de API em pelo menos 4 situações distintas dentro do fluxo.
  - [ ] Fontes/finalidades genuinamente diferentes entre si.
  - [ ] Propósito real no domínio do sistema (não apenas para cumprir requisito).
  - *No projeto Ink & Glow:*
    1. **ViaCEP:** Preenchimento e validação automática de endereço de clientes e profissionais.
    2. **BrasilAPI (Feriados Nacionais):** Verificação de feriados para bloqueio/alerta na agenda do estúdio.
    3. **Open-Meteo / WeatherAPI (Previsão do Tempo):** Alerta climático na data da sessão (cuidados pós-procedimento com exposição solar, calor e cicatrização de pele/tatuagem).
    4. **AwesomeAPI / BrasilAPI (Cotações & Cobrança PIX):** Geração dinâmica de payload/QR Code PIX para pagamento e cotação para atendimento a clientes/artistas estrangeiros.

- [ ] **4. Segurança:**
  - [ ] Senhas nunca armazenadas em texto puro (utilização de algoritmo de hash seguro: `bcryptjs`).
  - [ ] Validação rigorosa de dados de entrada em todas as camadas.
  - [ ] Controle de acesso por papéis/perfis (RBAC: Admin, Tatuador, Esteticista, Atendente).
  - [ ] Proteção de dados sensíveis e anamnese de saúde (conformidade com princípios da LGPD).
  - [ ] Justificativa documentada das decisões de segurança adotadas para o sistema.

- [ ] **5. Código Modularizado em Classes (POO):**
  - [ ] Lógica de negócio organizada em classes (Programação Orientada a Objetos).
  - [ ] Separação clara de responsabilidades: Entidades de Domínio, Repositories, Services e Controllers/IPC Handlers.
  - [ ] Ausência de funções soltas e desorganizadas na lógica central.

- [ ] **6. Aplicação Desktop em Electron com TypeScript:**
  - [ ] Estrutura desktop nativa com Electron.
  - [ ] TypeScript utilizado em toda a lógica da aplicação (Main, Preload e Renderer).
  - [ ] Sem arquivos `.js` soltos para a lógica da aplicação.
  - [ ] Arquitetura segura de IPC (`contextIsolation: true`, `nodeIntegration: false`).

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
