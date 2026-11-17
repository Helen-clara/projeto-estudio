# CLAUDE.md

**Fonte oficial do escopo:** [docs/CONTEXTO.md](docs/CONTEXTO.md). Leia também [docs/CHECKLIST_REQUISITOS.md](docs/CHECKLIST_REQUISITOS.md) antes de começar qualquer parte.

## Regras técnicas
- TypeScript `strict: true`; nada de `any` sem justificativa.
- **Sem arquivos `.js` escritos à mão** — só a saída de build em `dist/`.
- POO: classes, encapsulamento, herança (`BaseRepository`), interfaces, injeção de dependência via construtor.
- Camadas: Renderer → IPC → Handler → Service → Repository → MySQL. O renderer nunca acessa o banco.
- SQL somente com **prepared statements** (mysql2); nunca interpolar entrada do usuário.
- Senhas com **bcryptjs**. Não logar CPF/senha (LGPD). Credenciais só no `.env`.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` quando possível, API mínima no preload.
- Interface e mensagens em português do Brasil; tipos compartilhados em `src/shared/`.

## Git
- Uma branch por parte: `feat/<modulo>`; PR para `main` ao final, após `npm run build` sem erros.
- Commits pequenos, em português, no padrão `tipo(escopo): descrição` (ex.: `feat(clientes): adiciona consulta de CEP`).
- **Nunca alterar `git config user.name` / `user.email`** — cada membro commita com a própria identidade. Se estiverem vazios, pare e avise.
- Nunca commitar `node_modules/`, `dist/` ou `.env`.
