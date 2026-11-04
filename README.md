# Ink & Glow Studio 🎨✨
> Aplicação desktop profissional em **Electron**, **TypeScript** (POO) e **MySQL** para gestão completa de estúdio de estética e tatuagem.

Projeto desenvolvido para a disciplina **DAD (Desenvolvimento de Aplicações Desktop)** sob orientação do professor **willcotil**.

---

## 🛠️ Tecnologias Utilizadas

- **Electron** (Processos Main, Preload e Renderer isolados)
- **TypeScript** (Paradigma Orientado a Objetos - POO com modo estrito)
- **MySQL** (`mysql2` com Prepared Statements)
- **Bcrypt.js** (Criptografia segura de senhas)
- **Dotenv** (Gerenciamento de variáveis de ambiente)

---

## 📋 Requisitos e Documentação

- [Checklist de Requisitos Obrigatórios](docs/CHECKLIST_REQUISITOS.md)
- [Contexto e Arquitetura do Sistema](docs/CONTEXTO.md)
- [Especificação Oficial do Professor (PDF)](docs/requisitos.pdf)

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
- **Node.js** (versão 18 ou superior instalada)
- **npm** (incluso com Node.js)
- **MySQL Server** (local ou remoto)

### 2. Instalação das Dependências
No terminal do projeto, execute:
```bash
npm install
```

### 3. Configuração do Ambiente (.env)
Copie o arquivo de exemplo de ambiente e preencha com as credenciais do seu MySQL:
```bash
cp .env.example .env
```
*(No Windows PowerShell: `Copy-Item .env.example .env`)*

### 4. Compilação TypeScript
Compile o código TypeScript dos processos Main e Renderer:
```bash
npm run build
```

### 5. Execução da Aplicação Desktop
Inicie a aplicação Electron:
```bash
npm start
```

---

## 📁 Estrutura do Projeto

```
dad-projeto/
├── .env.example                # Template de variáveis de ambiente
├── .gitignore                  # Arquivos ignorados pelo Git
├── package.json                # Dependências e scripts
├── tsconfig.json               # Configuração base do TypeScript
├── tsconfig.main.json          # Compilação do processo Main e Preload
├── tsconfig.renderer.json      # Compilação do processo Renderer
├── docs/                       # Documentações do projeto e requisitos
├── database/                   # Scripts SQL (Parte 2)
└── src/
    ├── main/                   # Processo Principal do Electron (Backend)
    │   ├── main.ts             # Lifecycle e criação da janela
    │   ├── config/             # Conexão MySQL
    │   ├── core/               # POO: Entities, Repositories e Services
    │   ├── integrations/       # Consumo das 4 APIs
    │   └── ipc/                # Handlers IPC
    ├── preload/                # Ponte segura de contexto (Preload)
    └── renderer/               # Interface de usuário (Frontend Desktop)
```

---

## 🗺️ Roadmap de Desenvolvimento (8 Partes)

1. [x] **Parte 1: Configuração Inicial & Infraestrutura Base**
2. [ ] **Parte 2: Modelagem de Dados & Scripts MySQL (7 Tabelas Relacionadas)**
3. [ ] **Parte 3: Camada de Domínio & Repositories (POO & Prepared Statements)**
4. [ ] **Parte 4: Camada de Serviços & Segurança (Bcrypt, Validações e Regras de Negócio)**
5. [ ] **Parte 5: Integrações com as 4 APIs Externas (ViaCEP, Feriados, Clima e PIX)**
6. [ ] **Parte 6: Camada IPC do Electron (Comunicação Segura)**
7. [ ] **Parte 7: Interface Desktop & Telas de CRUDs**
8. [ ] **Parte 8: Auditoria de Segurança, Testes Finais e Homologação**
