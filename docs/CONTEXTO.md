# Contexto do Projeto: Ink & Glow Studio
**Sistema de Gestão Desktop para Estúdio de Estética e Tatuagem**  
**Disciplina:** DAD (Desenvolvimento de Aplicações Desktop)  
**Professor:** willcotil  

---

## 1. Visão Geral do Sistema

O **Ink & Glow Studio** é uma aplicação desktop desenvolvida em **Electron**, **TypeScript** (com paradigma Orientado a Objetos - POO) e banco de dados **MySQL**. A aplicação foi projetada para resolver os principais gargalos operacionais de um estúdio moderno que combina serviços de tatuagem artística, piercings e estética facial/corporal.

### Principais Dores Solucionadas:
1. **Centralização da Agenda:** Controle unificado de horários para profissionais com especialidades distintas (tatuadores e esteticistas), com checagem de feriados nacionais.
2. **Ficha de Anamnese Digital e Segura:** Registro de condições de saúde, alergias, tipo de pele e histórico médico dos clientes, respeitando normas de segurança e privacidade (LGPD).
3. **Gestão de Procedimentos e Orientações Climáticas:** Emissão de alertas e recomendações de cuidados pós-procedimento adaptados às condições meteorológicas do dia do atendimento (ex: radiação solar alta prejudica tatuagens recentes e peelings químicos).
4. **Cobranças Ágeis:** Geração de cobranças integradas via PIX e suporte à cotação de moedas para atendimento a clientes estrangeiros e artistas convidados (*guest artists*).

---

## 2. Divisão do Projeto em 8 Partes (4 Integrantes)

O desenvolvimento do sistema está estruturado em 8 marcos progressivos distribuídos de forma equilibrada entre os 4 membros do grupo, garantindo commits contínuos e identificáveis de todos os integrantes no GitHub:

| Parte | Título do Módulo | Foco do Desenvolvimento | Responsável Sugerido |
| :---: | :--- | :--- | :---: |
| **Parte 1** | **Configuração Inicial & Infraestrutura Base** | Inicialização do Git, configurações de compilação TS, Electron Base, IPC seguro e tema base. | Integrante 1 |
| **Parte 2** | **Modelagem de Dados & Scripts MySQL** | Scripts DDL com as 7 tabelas relacionais, constraints de FKs, índices e seeds iniciais. | Integrante 2 |
| **Parte 3** | **Camada de Domínio & Repositories (POO)** | Criação das classes Entidades e Repositories tipados com Prepared Statements contra SQL Injection. | Integrante 3 |
| **Parte 4** | **Camada de Serviços & Segurança** | Implementação de regras de negócio em classes (Services), criptografia de senhas (`bcryptjs`) e validações. | Integrante 4 |
| **Parte 5** | **Integrações com as 4 APIs Externas** | Módulos de conexão com ViaCEP, BrasilAPI (Feriados), Open-Meteo (Clima) e AwesomeAPI/PIX. | Integrante 1 |
| **Parte 6** | **Camada IPC do Electron (Ponte Segura)** | Handlers tipados no processo Main e exposição restrita no Preload (`contextBridge`). | Integrante 2 |
| **Parte 7** | **Interface Desktop & Formulários CRUD** | Telas modernas em Dark Theme, componentes de formulário, validações visuais e feedback. | Integrante 3 |
| **Parte 8** | **Auditoria de Segurança, Testes & Homologação** | Verificação dos requisitos do professor, tratamento de exceções globais, documentação final e entrega. | Integrante 4 |

---

## 3. Estrutura de Pastas do Projeto

O código do projeto adota uma arquitetura em camadas (Clean / N-Tier Architecture) estritamente tipada em TypeScript:

```
dad-projeto/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── README.md
├── docs/
│   ├── CHECKLIST_REQUISITOS.md
│   ├── CONTEXTO.md
│   └── requisitos.pdf
├── database/
│   ├── schema.sql
│   └── seed.sql
└── src/
    ├── main/
    │   ├── main.ts
    │   ├── config/
    │   ├── core/
    │   │   ├── entities/
    │   │   ├── repositories/
    │   │   └── services/
    │   ├── integrations/
    │   └── ipc/
    ├── preload/
    │   ├── preload.ts
    │   └── index.d.ts
    └── renderer/
        ├── index.html
        ├── assets/
        ├── components/
        ├── views/
        ├── styles/
        └── renderer.ts
```

---

## 4. As 7 Tabelas Relacionais do Banco MySQL

1. **`usuarios`**: Gestão de acessos com senhas criptografadas (`bcryptjs`) e papéis (Admin, Tatuador, Esteticista, Atendente).
2. **`clientes`**: Informações cadastrais completas com endereço vinculado via API de CEP.
3. **`anamneses`**: Informações médicas e de saúde vinculadas ao cliente (alergias, tipo de pele, queloide).
4. **`servicos`**: Catálogo de procedimentos disponíveis com preço base e tempo estimado.
5. **`agendamentos`**: Sessões agendadas vinculando cliente, profissional prestador e serviço.
6. **`pagamentos`**: Registros financeiros da sessão (PIX, Cartão, Dinheiro).
7. **`referencias_visuais`**: Portfólio, estilos de arte e imagens de referência para tatuagens/procedimentos.

---

## 5. As 4 APIs Externas e suas Finalidades

1. **ViaCEP API:** Preenchimento automático de endereço dos clientes no cadastro via CEP.
2. **BrasilAPI (Feriados Nacionais):** Bloqueio e verificação automática de expedientes especiais na agenda.
3. **Open-Meteo / WeatherAPI:** Obtenção das condições meteorológicas (temperatura/UV) da data marcada para emissão de alertas de cicatrização.
4. **AwesomeAPI / BrasilAPI (Cotações & PIX):** Geração dinâmica de cobrança PIX e cálculo de cotação de câmbio para clientes e artistas internacionais.
