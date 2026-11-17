# Ink & Glow Studio 🎨✨
> Aplicação desktop em **Electron**, **TypeScript** (POO) e **MySQL** para gestão de estúdio de estética e tatuagem: clientes, profissionais, serviços, agenda, histórico de atendimentos, estoque e lembretes automáticos.

Projeto desenvolvido para a disciplina **DAD (Desenvolvimento de Aplicações Desktop)** sob orientação do professor **willcotil**.
O escopo oficial está em [docs/CONTEXTO.md](docs/CONTEXTO.md).

---

## 🛠️ Tecnologias

- **Electron** (processos Main, Preload e Renderer isolados, `contextIsolation`)
- **TypeScript** estrito, orientado a objetos (sem `.js` escrito à mão)
- **MySQL** com **mysql2** (prepared statements)
- **bcryptjs** (hash de senhas)
- **dotenv** (configuração via `.env`)
- **Nodemailer** (envio de lembretes por e-mail via SMTP)
- **node-cron** (agendador de lembretes)
- **ts-node**, **concurrently**, **rimraf**, **ESLint** (ferramentas de desenvolvimento)

## 👥 Perfis de acesso

- **ADMIN** — acesso total.
- **RECEPCAO** — clientes, agenda e estoque (leitura).
- **PROFISSIONAL** (`TATUADOR` ou `ESTETICISTA`) — própria agenda, conclusão de atendimentos e consumo de material.

## 🗄️ Banco de dados (8 tabelas)

`usuarios`, `clientes`, `servicos`, `profissional_servicos` (N:N), `agendamentos`, `materiais`, `movimentacoes_estoque`, `lembretes`.

## 🌐 APIs externas

| API | Uso no sistema |
| :--- | :--- |
| **ViaCEP** | Preenche o endereço do cliente a partir do CEP. |
| **AwesomeAPI** | Cotação USD→BRL do preço de custo dos materiais. |
| **BrasilAPI** | Aviso de feriado nacional na agenda. |
| **Open-Meteo** | Previsão do tempo para a dica de cuidado no lembrete. |

---

## 📋 Documentação

- [Contexto e arquitetura (fonte oficial)](docs/CONTEXTO.md)
- [Checklist de requisitos](docs/CHECKLIST_REQUISITOS.md)
- [Especificação do professor (PDF)](docs/requisitos.pdf)

---

## 🚀 Como executar

### 1. Pré-requisitos
- **Node.js** 18 ou superior
- **MySQL Server** (local ou remoto)

### 2. Instalação
```bash
npm install
```

### 3. Configuração do ambiente
```bash
cp .env.example .env
```
*(No Windows PowerShell: `Copy-Item .env.example .env`)* — preencha credenciais do MySQL, SMTP e localização do estúdio.

### 4. Banco de dados
```bash
npm run db:init
```
```bash
npm run db:check
```
*(Scripts implementados na Parte 2.)*

### 5. Executar
```bash
npm start
```
Modo desenvolvimento (recompila ao salvar):
```bash
npm run dev
```

---

## 📁 Estrutura

```
src/
  main/
    main.ts            # cria a janela e registra IPC
    config/            # leitura do .env
    core/
      database/        # Database (Singleton) e BaseRepository
      entities/        # classes de domínio
      repositories/    # acesso ao MySQL (SQL parametrizado)
      services/        # regras de negócio
      security/        # autenticação, sessão e permissões
      validators/      # CPF, e-mail, telefone, CEP
    integrations/      # clientes das 4 APIs
    ipc/               # handlers por módulo
  preload/             # contextBridge e API tipada
  renderer/            # telas (HTML/CSS/TS)
  shared/              # tipos e enums compartilhados
database/              # schema.sql e seed.sql
scripts/               # initDb.ts, checkDb.ts
docs/                  # documentação
```

---

## 🗺️ Roadmap

0. [ ] **Parte 0:** Alinhamento da base ao escopo oficial
1. [x] **Parte 1:** Configuração inicial & infraestrutura
2. [ ] **Parte 2:** Banco de dados MySQL (8 tabelas)
3. [ ] **Parte 3:** Domínio & repositories
4. [ ] **Parte 4:** Serviços, segurança & validação
5. [ ] **Parte 5:** Integrações com as 4 APIs
6. [ ] **Parte 6:** Camada IPC & lembretes
7. [ ] **Parte 7:** Interface desktop & CRUDs
8. [ ] **Parte 8:** Auditoria, testes & entrega
