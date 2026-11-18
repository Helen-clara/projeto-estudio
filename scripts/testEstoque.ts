/**
 * Teste manual do estoque (Parte 7), contra o banco do .env e a cotação real da AwesomeAPI.
 *
 *   npx ts-node scripts/testEstoque.ts            executa e, no fim, inativa os materiais criados
 *   npx ts-node scripts/testEstoque.ts --manter   mantém os materiais criados
 *
 * Demonstra: cadastro com preço em USD (BRL calculado pela cotação) e em BRL, entrada,
 * saída, saldo insuficiente, ajuste de inventário, alerta de estoque baixo, regras do
 * profissional, estorno, recálculo de preços, relatório de valor e consumo por período.
 */
import { Database } from '../src/main/core/database/Database';
import { DomainError } from '../src/main/core/entities';
import { DataHora } from '../src/main/core/entities/Agendamento';
import { AgendamentoRepository, MaterialRepository, MovimentacaoRepository } from '../src/main/core/repositories';
import { CotacaoService, EstoqueService } from '../src/main/core/services';
import { CotacaoClient } from '../src/main/integrations/CotacaoClient';

const ADMIN = 1;
const TATUADOR = 3;
const ESTETICISTA = 4;

class TesteEstoque {
  private falhas = 0;
  private readonly db = Database.getInstance();
  private readonly materiais = new MaterialRepository(this.db);
  private readonly estoque = new EstoqueService(
    this.materiais,
    new MovimentacaoRepository(this.db),
    new CotacaoService(new CotacaoClient(), this.materiais),
    this.db,
  );
  private readonly criados: number[] = [];

  constructor(private readonly manter: boolean) {}

  public async executar(): Promise<boolean> {
    try {
      await this.cenarios();
    } finally {
      await this.limpar();
    }
    console.log(this.falhas === 0 ? '\n✔ Todos os testes do estoque passaram.' : `\n✖ ${this.falhas} teste(s) falharam.`);
    return this.falhas === 0;
  }

  private async cenarios(): Promise<void> {
    const sfx = Date.now().toString().slice(-5);
    const admin = { usuarioId: ADMIN, apenasConsumoProprio: false };

    // 1. Cotação
    const cot = await this.estoque.cotacaoAtual();
    this.check(cot !== null, `Cotação USD→BRL: ${cot?.valor} (${cot?.fonte}${cot?.desatualizada ? ', desatualizada' : ''}, ${cot?.dataHora})`);
    const valorCot = cot?.valor ?? 0;

    // 2. Cadastro com preço em USD e estoque inicial
    const tinta = await this.estoque.criar({
      nome: `Tinta teste ${sfx}`, categoria: 'TATUAGEM', unidade: 'frasco', estoqueMinimo: 3,
      precoCusto: { moeda: 'USD', valor: 19.9 }, fornecedor: 'Ink Supply Co.', quantidadeInicial: 5,
    }, ADMIN);
    const t = tinta.material;
    this.criados.push(t.id);
    const brlEsperado = Math.round(19.9 * valorCot * 100) / 100;
    this.check(t.precoCustoUsd === 19.9 && t.precoCustoBrl === brlEsperado && t.cotacaoUsada === valorCot,
      `Material em USD: US$ ${t.precoCustoUsd} → R$ ${t.precoCustoBrl} (cotação ${t.cotacaoUsada}), saldo inicial ${t.quantidadeAtual}`);

    // 3. Cadastro com preço em BRL (USD calculado)
    const serum = await this.estoque.criar({
      nome: `Sérum teste ${sfx}`, categoria: 'ESTETICA', unidade: 'frasco', estoqueMinimo: 1, precoCusto: { moeda: 'BRL', valor: 120 },
    }, ADMIN);
    this.criados.push(serum.material.id);
    this.check(serum.material.precoCustoBrl === 120 && serum.material.precoCustoUsd !== null,
      `Material em BRL: R$ 120,00 → US$ ${serum.material.precoCustoUsd}`);
    await this.erro('Nome de material duplicado', 'ConflictError', () =>
      this.estoque.criar({ nome: `Tinta teste ${sfx}`, categoria: 'TATUAGEM', unidade: 'frasco', estoqueMinimo: 1 }, ADMIN));

    // 4. Entrada e saída
    const e = await this.estoque.movimentar({ materialId: t.id, tipo: 'ENTRADA', quantidade: 4, motivo: 'Compra NF 123' }, admin);
    this.check(e.material.quantidadeAtual === 9, `Entrada de 4 → saldo ${e.material.quantidadeAtual}`);
    const s = await this.estoque.movimentar({ materialId: t.id, tipo: 'SAIDA', quantidade: 7, motivo: 'Uso em sessões' }, admin);
    this.check(s.material.quantidadeAtual === 2 && s.material.estoqueBaixo, `Saída de 7 → saldo ${s.material.quantidadeAtual}: "${s.avisos[0]}"`);

    // 5. Saldo insuficiente e validações
    await this.erro('Saída maior que o saldo', 'ConflictError', () =>
      this.estoque.movimentar({ materialId: t.id, tipo: 'SAIDA', quantidade: 10 }, admin));
    await this.erro('Quantidade zero', 'ValidationError', () =>
      this.estoque.movimentar({ materialId: t.id, tipo: 'ENTRADA', quantidade: 0 }, admin));
    await this.erro('Ajuste sem motivo', 'ValidationError', () =>
      this.estoque.movimentar({ materialId: t.id, tipo: 'AJUSTE', quantidade: 6 }, admin));

    // 6. Ajuste de inventário
    const aj = await this.estoque.movimentar({ materialId: t.id, tipo: 'AJUSTE', quantidade: 6, motivo: 'Contagem física mensal' }, admin);
    this.check(aj.material.quantidadeAtual === 6 && aj.movimentacao.tipo === 'AJUSTE' && aj.movimentacao.quantidade === 4,
      `Ajuste para 6 (contagem): diferença +${aj.movimentacao.quantidade}, motivo "${aj.movimentacao.motivo}"`);

    // 7. Alerta de estoque baixo
    await this.estoque.movimentar({ materialId: t.id, tipo: 'SAIDA', quantidade: 3, motivo: 'Uso' }, admin);
    const alertas = await this.estoque.alertas();
    this.check(alertas.some((a) => a.id === t.id), `Alerta de estoque baixo: ${alertas.length} material(is), inclui "${t.nome}" (3 ≤ mínimo 3)`);
    const filtro = await this.estoque.listar({ apenasEstoqueBaixo: true, termo: `teste ${sfx}` });
    this.check(filtro.items.some((m) => m.id === t.id) && filtro.items.every((m) => m.estoqueBaixo),
      `Filtro "apenas estoque baixo": ${filtro.items.map((m) => `${m.nome} (${m.quantidadeAtual}/${m.estoqueMinimo})`).join(', ')}`);

    // 8. Regras do profissional (consumo próprio)
    const agenda = new AgendamentoRepository(this.db);
    const doTatuador = (await agenda.buscar({ profissionalId: TATUADOR, status: ['AGENDADO', 'CONFIRMADO'], limit: 1 })).items[0];
    const tatuador = { usuarioId: TATUADOR, apenasConsumoProprio: true };
    await this.erro('Profissional registrando ENTRADA', 'ForbiddenError', () =>
      this.estoque.movimentar({ materialId: t.id, tipo: 'ENTRADA', quantidade: 1 }, tatuador));
    await this.erro('Profissional sem informar o atendimento', 'ValidationError', () =>
      this.estoque.movimentar({ materialId: t.id, tipo: 'SAIDA', quantidade: 1 }, tatuador));
    if (doTatuador) {
      const agId = doTatuador.agendamento.id as number;
      await this.erro('Profissional usando atendimento de outro', 'ForbiddenError', () =>
        this.estoque.movimentar({ materialId: t.id, tipo: 'SAIDA', quantidade: 1, agendamentoId: agId }, { usuarioId: ESTETICISTA, apenasConsumoProprio: true }));
      const consumo = await this.estoque.movimentar({ materialId: t.id, tipo: 'SAIDA', quantidade: 1, agendamentoId: agId, motivo: 'Consumo no atendimento' }, tatuador);
      this.check(consumo.movimentacao.agendamentoId === agId && consumo.material.quantidadeAtual === 2,
        `Tatuador registra consumo no próprio atendimento #${agId} → saldo ${consumo.material.quantidadeAtual}`);

      // 9. Estorno (exclusão lógica da movimentação)
      const est = await this.estoque.estornar(consumo.movimentacao.id);
      this.check(est.material.quantidadeAtual === 3 && !est.movimentacao.ativo, `Estorno do consumo → saldo volta a ${est.material.quantidadeAtual}`);
    }
    await this.erro('Estornar entrada já consumida', 'ConflictError', () => this.estoque.estornar(e.movimentacao.id));

    // 10. Recálculo, relatório e consumo
    const rec = await this.estoque.recalcularPrecos();
    this.check(rec.atualizados >= 1, `Recalcular preços em BRL: ${rec.atualizados} atualizado(s), ${rec.ignorados} sem preço em USD`);
    const rel = await this.estoque.relatorio();
    this.check(rel.valorTotalBrl > 0 && rel.valorTotalUsd > 0,
      `Relatório: ${rel.totalItens} itens, R$ ${rel.valorTotalBrl.toFixed(2)} / US$ ${rel.valorTotalUsd.toFixed(2)}, ${rel.itensEstoqueBaixo} com estoque baixo`);
    const hoje = DataHora.formatarData(new Date());
    const cons = await this.estoque.consumo(hoje, hoje);
    const item = cons.porMaterial.find((m) => m.chave === String(t.id));
    this.check(item?.quantidade === 10, `Consumo de hoje: "${t.nome}" ${item?.quantidade} un. (saídas 7 + 3; ajuste e estorno não contam), por categoria: ${cons.porCategoria.map((c) => `${c.rotulo} R$ ${c.valorBrl.toFixed(2)}`).join(', ')}`);

    const movs = await this.estoque.listarMovimentacoes({ materialId: t.id, ativo: 'todos' });
    console.log('ℹ Movimentações do material:');
    for (const m of movs.items.reverse()) {
      console.log(`   ${m.data}  ${m.tipo.padEnd(7)} ${m.efeito > 0 ? '+' : '-'}${m.quantidade}  ${m.motivo ?? ''}${m.ativo ? '' : '  (estornada)'}`);
    }
  }

  private async limpar(): Promise<void> {
    if (this.manter) {
      console.log(`ℹ --manter: materiais ${this.criados.join(', ')} mantidos.`);
      return;
    }
    for (const id of this.criados) await this.estoque.inativar(id);
    console.log(`ℹ Limpeza: materiais de teste ${this.criados.join(', ')} inativados (exclusão lógica).`);
  }

  private check(condicao: boolean, descricao: string): void {
    console.log(`${condicao ? '✔' : '✖'} ${descricao}`);
    if (!condicao) this.falhas++;
  }

  private async erro(descricao: string, tipo: string, acao: () => Promise<unknown>): Promise<void> {
    try {
      await acao();
      this.check(false, `${descricao}: deveria ter sido bloqueado`);
    } catch (error) {
      const ok = error instanceof DomainError && error.name === tipo;
      this.check(ok, `${descricao} bloqueado (${(error as Error).name}): "${(error as Error).message}"`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const ok = await new TesteEstoque(process.argv.includes('--manter')).executar();
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error('✖ Erro inesperado:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await Database.getInstance().close();
  }
}

void main();
