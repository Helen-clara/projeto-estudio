/**
 * Teste manual dos cadastros (Parte 3), contra o banco configurado no .env.
 *
 *   npx ts-node scripts/testCadastros.ts            executa e, no fim, inativa o que criou
 *   npx ts-node scripts/testCadastros.ts --manter   mantém ativos os registros criados
 *
 * Demonstra: consulta de CEP real (ViaCEP), criação/edição/busca de cliente,
 * criação de serviço, vínculo com profissional e as regras de negócio
 * (CPF único, especialidade × categoria, inativação bloqueada).
 */
import { Database } from '../src/main/core/database/Database';
import { DomainError } from '../src/main/core/entities';
import { CadastrosContainer } from '../src/main/ipc/CadastrosContainer';

class TesteCadastros {
  private falhas = 0;

  constructor(
    private readonly c: CadastrosContainer,
    private readonly manter: boolean,
  ) {}

  public async executar(): Promise<boolean> {
    const sufixo = Date.now().toString().slice(-6);

    // 1. CEP real
    const cep = await this.c.clientes.buscarEnderecoPorCep('01310-100');
    this.check(cep.encontrado, `ViaCEP 01310-100 → ${cep.endereco?.logradouro}, ${cep.endereco?.bairro}, ${cep.endereco?.cidade}/${cep.endereco?.uf}`, cep.mensagem);
    const cepInvalido = await this.c.clientes.buscarEnderecoPorCep('123');
    this.check(!cepInvalido.encontrado, `CEP inválido não quebra: "${cepInvalido.mensagem}"`);

    // 2. Cliente com o endereço do CEP
    const cpf = TesteCadastros.gerarCpf();
    const salvo = await this.c.clientes.criar({
      nome: `Cliente Teste ${sufixo}`,
      cpf,
      dataNascimento: '2010-05-20',
      telefone: '(11) 98888-7777',
      email: `teste${sufixo}@exemplo.com`,
      endereco: cep.endereco ? { ...cep.endereco, numero: '1578' } : null,
    });
    const cliente = salvo.cliente;
    this.check(cliente.id > 0, `Cliente criado #${cliente.id} (${cliente.nome}), endereço: ${cliente.endereco?.logradouro}, ${cliente.endereco?.numero}`);
    this.check(salvo.avisos.length === 1, `Aviso de menor de idade: "${salvo.avisos[0]}"`);

    const busca = await this.c.clientes.listar({ termo: `Teste ${sufixo}` });
    this.check(busca.total === 1, `Busca por nome encontrou ${busca.total} cliente(s)`);
    const buscaCpf = await this.c.clientes.listar({ termo: cpf.slice(0, 6) });
    this.check(buscaCpf.items.some((x) => x.id === cliente.id), 'Busca pelo início do CPF encontrou o cliente');

    const editado = await this.c.clientes.atualizar(cliente.id, {
      nome: cliente.nome,
      cpf,
      dataNascimento: '1990-05-20',
      telefone: '11 3333-4444',
      email: cliente.email,
      endereco: cliente.endereco,
    });
    this.check(editado.avisos.length === 0 && editado.cliente.telefone === '1133334444', 'Edição do cliente (maior de idade, telefone fixo)');

    await this.esperarErro('CPF duplicado', 'ConflictError', () =>
      this.c.clientes.criar({ nome: 'Outro Cliente', cpf, dataNascimento: '1990-01-01' }),
    );
    await this.esperarErro('CPF inválido', 'ValidationError', () =>
      this.c.clientes.criar({ nome: 'Outro Cliente', cpf: '123.456.789-00', dataNascimento: '1990-01-01' }),
    );

    // 3. Serviço
    const servico = await this.c.servicos.criar({
      nome: `Teste fine line ${sufixo}`,
      descricao: 'Criado pelo script de teste',
      categoria: 'TATUAGEM',
      duracaoMinutos: 120,
      preco: 380.5,
    });
    this.check(servico.id > 0, `Serviço criado #${servico.id} (${servico.nome}, R$ ${servico.preco.toFixed(2)})`);

    // 4. Vínculo com profissional tatuador
    const tatuadores = await this.c.profissionais.listar({ especialidade: 'TATUADOR' });
    const tatuador = tatuadores.items[0];
    if (!tatuador) {
      this.check(false, 'Nenhum tatuador ativo encontrado (rode npm run db:init)');
      return this.finalizar(cliente.id, servico.id, null);
    }
    await this.c.profissionais.vincularServico(tatuador.id, servico.id);
    const comServicos = await this.c.profissionais.obter(tatuador.id);
    this.check(
      comServicos.servicos?.some((s) => s.id === servico.id) ?? false,
      `Serviço vinculado a ${tatuador.nome}: ${comServicos.servicos?.map((s) => s.nome).join(', ')}`,
    );

    const estetica = (await this.c.servicos.listar({ categoria: 'ESTETICA', limit: 1 })).items[0];
    if (estetica) {
      await this.esperarErro('Tatuador com serviço de estética', 'ValidationError', () =>
        this.c.profissionais.vincularServico(tatuador.id, estetica.id),
      );
    }

    // 5. Regra: não inativar serviço com agendamento futuro (seed: "Tatuagem fine line" tem agendamento futuro)
    const comAgenda = (await this.c.servicos.listar({ termo: 'Tatuagem fine line' })).items[0];
    if (comAgenda) {
      await this.esperarErro('Inativar serviço com agendamento futuro', 'ConflictError', () =>
        this.c.servicos.inativar(comAgenda.id),
      );
    }

    return this.finalizar(cliente.id, servico.id, tatuador.id);
  }

  private async finalizar(clienteId: number, servicoId: number, profissionalId: number | null): Promise<boolean> {
    if (!this.manter) {
      if (profissionalId) await this.c.profissionais.desvincularServico(profissionalId, servicoId);
      await this.c.servicos.inativar(servicoId);
      await this.c.clientes.inativar(clienteId);
      const cliente = await this.c.clientes.obter(clienteId);
      const servico = await this.c.servicos.obter(servicoId);
      this.check(
        !cliente.ativo && !servico.ativo,
        `Limpeza: vínculo removido, serviço #${servicoId} e cliente #${clienteId} inativados (exclusão lógica)`,
      );
    } else {
      console.log(`ℹ --manter: cliente #${clienteId} e serviço #${servicoId} continuam ativos.`);
    }
    console.log(this.falhas === 0 ? '\n✔ Todos os testes passaram.' : `\n✖ ${this.falhas} teste(s) falharam.`);
    return this.falhas === 0;
  }

  private check(condicao: boolean, descricao: string, detalhe?: string): void {
    if (condicao) {
      console.log(`✔ ${descricao}`);
    } else {
      this.falhas++;
      console.log(`✖ ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
    }
  }

  private async esperarErro(descricao: string, tipo: string, acao: () => Promise<unknown>): Promise<void> {
    try {
      await acao();
      this.check(false, `${descricao}: deveria ter sido bloqueado`);
    } catch (error) {
      const ok = error instanceof DomainError && error.name === tipo;
      this.check(ok, `${descricao} bloqueado (${(error as Error).name}): "${(error as Error).message}"`);
    }
  }

  /** CPF aleatório com dígitos verificadores válidos. */
  private static gerarCpf(): string {
    const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    for (const tamanho of [9, 10]) {
      const soma = n.slice(0, tamanho).reduce((acc, d, i) => acc + d * (tamanho + 1 - i), 0);
      const resto = (soma * 10) % 11;
      n.push(resto === 10 ? 0 : resto);
    }
    return n.join('');
  }
}

async function main(): Promise<void> {
  try {
    const ok = await new TesteCadastros(new CadastrosContainer(), process.argv.includes('--manter')).executar();
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error('✖ Erro inesperado:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await Database.getInstance().close();
  }
}

void main();
