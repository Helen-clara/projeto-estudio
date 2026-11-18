import type { CategoriaValor, PaginaDTO } from '../../../shared/dtos';
import type {
  ConsumoPeriodoDTO,
  FiltroMateriais,
  FiltroMovimentacoes,
  MaterialDTO,
  MaterialInput,
  MaterialSalvoDTO,
  MovimentacaoDTO,
  MovimentacaoInput,
  MovimentacaoRegistradaDTO,
  RecalculoPrecosDTO,
  RelatorioEstoqueDTO,
} from '../../../shared/estoque';
import { SqlExecutor } from '../database/Database';
import { ConflictError, NotFoundError, ValidationError } from '../entities';
import { ForbiddenError } from '../security/SecurityErrors';
import { DataHora } from '../entities/Agendamento';
import { Material } from '../entities/Material';
import { MovimentacaoEstoque } from '../entities/MovimentacaoEstoque';
import { MaterialRepository, MovimentacaoDetalhada, MovimentacaoRepository } from '../repositories';
import { CotacaoService } from './CotacaoService';
import { UnidadeDeTrabalho, gravarComUnicidade, paginaDTO } from './ServiceSupport';

/** Quem está movimentando: usado para registrar o usuário e restringir o profissional. */
export interface AutorMovimentacao {
  usuarioId: number;
  /** true = só pode registrar SAÍDA ligada a um atendimento próprio (perfil PROFISSIONAL). */
  apenasConsumoProprio: boolean;
}

const ROTULO_CATEGORIA: Record<CategoriaValor, string> = { TATUAGEM: 'Tatuagem', ESTETICA: 'Estética' };

/** Estoque de materiais: cadastro com preço USD/BRL, movimentações, alertas e relatórios. */
export class EstoqueService {
  constructor(
    private readonly materiais: MaterialRepository,
    private readonly movimentacoes: MovimentacaoRepository,
    private readonly cotacao: CotacaoService,
    private readonly uow: UnidadeDeTrabalho,
    private readonly relogio: () => Date = () => new Date(),
    private readonly reposEmTransacao: (tx: SqlExecutor) => { materiais: MaterialRepository; movimentacoes: MovimentacaoRepository } =
      (tx) => ({ materiais: new MaterialRepository(tx), movimentacoes: new MovimentacaoRepository(tx) }),
  ) {}

  // ------------------------------------------------------------- DTOs

  public static materialDTO(m: Material): MaterialDTO {
    return {
      id: m.id as number,
      nome: m.nome,
      categoria: m.categoria,
      unidade: m.unidade,
      quantidadeAtual: m.quantidadeAtual,
      estoqueMinimo: m.estoqueMinimo,
      estoqueBaixo: m.estoqueBaixo,
      precoCustoUsd: m.precoCustoUsd,
      precoCustoBrl: m.precoCustoBrl,
      cotacaoUsada: m.cotacaoUsada,
      cotacaoEm: m.cotacaoEm ? DataHora.formatar(m.cotacaoEm) : null,
      fornecedor: m.fornecedor,
      valorEstoqueBrl: m.valorEstoqueBrl,
      valorEstoqueUsd: m.valorEstoqueUsd,
      ativo: m.ativo,
    };
  }

  public static movimentacaoDTO(d: MovimentacaoDetalhada): MovimentacaoDTO {
    const m = d.movimentacao;
    return {
      id: m.id as number,
      materialId: m.materialId,
      materialNome: d.materialNome,
      unidade: d.unidade,
      tipo: m.tipo,
      quantidade: m.quantidade,
      efeito: m.efeito,
      motivo: m.motivo,
      agendamentoId: m.agendamentoId,
      usuarioId: m.usuarioId,
      usuarioNome: d.usuarioNome,
      data: DataHora.formatar(m.data),
      ativo: m.ativo,
    };
  }

  // ------------------------------------------------------------- materiais (CRUD)

  public async listar(filtro: FiltroMateriais = {}): Promise<PaginaDTO<MaterialDTO>> {
    return paginaDTO(await this.materiais.buscar(filtro), EstoqueService.materialDTO);
  }

  public async obter(id: number): Promise<MaterialDTO> {
    return EstoqueService.materialDTO(await this.materialOuFalhar(id));
  }

  /** Cadastra o material; a quantidade inicial (se houver) entra como ENTRADA na mesma transação. */
  public async criar(input: MaterialInput, usuarioId: number | null): Promise<MaterialSalvoDTO> {
    const material = Material.criar(input);
    const avisos = await this.aplicarPreco(material, input);
    await this.garantirNomeLivre(material.nome);

    const inicial = input.quantidadeInicial ?? 0;
    if (!Material.quantidadeValida(inicial)) {
      throw new ValidationError('Quantidade inicial inválida.', { quantidadeInicial: 'Use um número >= 0 com até 2 casas.' });
    }

    const id = await this.uow.transaction(async (tx) => {
      const r = this.reposEmTransacao(tx);
      const criado = await gravarComUnicidade(() => r.materiais.create(material.toProps()), 'Já existe um material com este nome.');
      if (inicial > 0) {
        const mov = MovimentacaoEstoque.registrar(criado, 'ENTRADA', inicial, 'Estoque inicial', null, usuarioId, this.relogio());
        criado.aplicarVariacao(mov.variacao);
        await r.movimentacoes.create(mov.paraGravacao());
        await r.materiais.atualizarQuantidade(criado.id as number, criado.quantidadeAtual);
      }
      return criado.id as number;
    });

    const salvo = await this.materialOuFalhar(id);
    if (salvo.estoqueBaixo) avisos.push(`Estoque de "${salvo.nome}" já está no mínimo ou abaixo.`);
    return { material: EstoqueService.materialDTO(salvo), avisos };
  }

  /** Edita dados cadastrais e, se informado, o preço. O saldo só muda por movimentação. */
  public async atualizar(id: number, input: MaterialInput): Promise<MaterialSalvoDTO> {
    const material = await this.materialOuFalhar(id);
    material.atualizarDados(input);
    const avisos = await this.aplicarPreco(material, input);
    await this.garantirNomeLivre(material.nome, id);
    // O saldo não é gravado aqui (só movimentações alteram quantidade_atual).
    const p = material.toProps();
    const dados = {
      nome: p.nome, categoria: p.categoria, unidade: p.unidade, estoqueMinimo: p.estoqueMinimo, fornecedor: p.fornecedor,
      precoCustoUsd: p.precoCustoUsd, precoCustoBrl: p.precoCustoBrl, cotacaoUsada: p.cotacaoUsada, cotacaoEm: p.cotacaoEm,
    };
    await gravarComUnicidade(() => this.materiais.update(id, dados), 'Já existe um material com este nome.');
    return { material: EstoqueService.materialDTO(await this.materialOuFalhar(id)), avisos };
  }

  /** Exclusão lógica: o material some das listas, mas o histórico de movimentações fica. */
  public async inativar(id: number): Promise<void> {
    await this.materialOuFalhar(id);
    await this.materiais.softDelete(id);
  }

  public async reativar(id: number): Promise<void> {
    await this.materialOuFalhar(id);
    await this.materiais.restore(id);
  }

  // ------------------------------------------------------------- movimentações

  /**
   * Registra ENTRADA, SAIDA ou AJUSTE numa transação, com a linha do material travada
   * (duas saídas simultâneas não conseguem deixar o saldo negativo).
   */
  public async movimentar(input: MovimentacaoInput, autor: AutorMovimentacao): Promise<MovimentacaoRegistradaDTO> {
    const agendamentoId = input.agendamentoId ?? null;
    await this.validarAgendamento(input, agendamentoId, autor);

    const movId = await this.uow.transaction(async (tx) => {
      const r = this.reposEmTransacao(tx);
      const material = await r.materiais.findParaAtualizar(input.materialId);
      if (!material) throw new NotFoundError('Material', input.materialId);
      if (!material.ativo) throw new ConflictError(`O material "${material.nome}" está inativo.`);

      const mov = MovimentacaoEstoque.registrar(material, input.tipo, input.quantidade, input.motivo, agendamentoId, autor.usuarioId, this.relogio());
      material.aplicarVariacao(mov.variacao); // lança ConflictError se a saída for maior que o saldo
      const criada = await r.movimentacoes.create(mov.paraGravacao());
      await r.materiais.atualizarQuantidade(material.id as number, material.quantidadeAtual);
      return criada.id as number;
    });

    const detalhe = await this.movimentacoes.findDetalhadoById(movId);
    const material = await this.materialOuFalhar(input.materialId);
    const avisos = material.estoqueBaixo
      ? [`Estoque baixo: "${material.nome}" está com ${material.quantidadeAtual} ${material.unidade} (mínimo ${material.estoqueMinimo}).`]
      : [];
    return { movimentacao: EstoqueService.movimentacaoDTO(detalhe as MovimentacaoDetalhada), material: EstoqueService.materialDTO(material), avisos };
  }

  public async listarMovimentacoes(filtro: FiltroMovimentacoes = {}): Promise<PaginaDTO<MovimentacaoDTO>> {
    const { de, ate } = EstoqueService.periodo(filtro.dataInicio, filtro.dataFim, false);
    const page = await this.movimentacoes.buscar({
      materialId: filtro.materialId, tipo: filtro.tipo, agendamentoId: filtro.agendamentoId,
      de, ate, ativo: filtro.ativo, limit: filtro.limit, offset: filtro.offset,
    });
    return paginaDTO(page, EstoqueService.movimentacaoDTO);
  }

  /** Corrige apenas o motivo (quantidades não são editadas: estorne e registre de novo). */
  public async editarMotivo(id: number, motivo: string | null): Promise<MovimentacaoDTO> {
    const atual = await this.movimentacoes.findById(id);
    if (!atual || !atual.ativo) throw new NotFoundError('Movimentação', id);
    atual.alterarMotivo(motivo);
    await this.movimentacoes.update(id, { motivo: atual.paraGravacao().motivo });
    return EstoqueService.movimentacaoDTO((await this.movimentacoes.findDetalhadoById(id)) as MovimentacaoDetalhada);
  }

  /** Exclusão lógica de uma movimentação: desfaz o efeito no saldo (estorno), na mesma transação. */
  public async estornar(id: number): Promise<MovimentacaoRegistradaDTO> {
    const materialId = await this.uow.transaction(async (tx) => {
      const r = this.reposEmTransacao(tx);
      const mov = await r.movimentacoes.findParaAtualizar(id);
      if (!mov || !mov.ativo) throw new NotFoundError('Movimentação', id);
      const material = await r.materiais.findParaAtualizar(mov.materialId);
      if (!material) throw new NotFoundError('Material', mov.materialId);
      try {
        material.aplicarVariacao(-mov.variacao);
      } catch {
        throw new ConflictError('Não é possível estornar esta entrada: o material já foi consumido e o saldo ficaria negativo.');
      }
      await r.materiais.atualizarQuantidade(material.id as number, material.quantidadeAtual);
      await r.movimentacoes.softDelete(id);
      return material.id as number;
    });
    const detalhe = await this.movimentacoes.findDetalhadoById(id);
    const material = await this.materialOuFalhar(materialId);
    return { movimentacao: EstoqueService.movimentacaoDTO(detalhe as MovimentacaoDetalhada), material: EstoqueService.materialDTO(material), avisos: ['Movimentação estornada.'] };
  }

  // ------------------------------------------------------------- alertas, cotação e relatórios

  /** Materiais ativos com quantidade <= estoque mínimo. */
  public async alertas(): Promise<MaterialDTO[]> {
    return (await this.materiais.listarEstoqueBaixo()).map(EstoqueService.materialDTO);
  }

  public cotacaoAtual(): ReturnType<CotacaoService['obterCotacao']> {
    return this.cotacao.obterCotacao();
  }

  /** Recalcula o custo em BRL de todos os materiais com preço em USD, pela cotação atual. */
  public async recalcularPrecos(): Promise<RecalculoPrecosDTO> {
    const cot = await this.cotacao.obterCotacao();
    if (!cot) throw new ConflictError('Cotação do dólar indisponível no momento: tente novamente mais tarde.');
    const quando = DataHora.parse(cot.dataHora) ?? this.relogio();
    const lista = await this.materiais.listarComPrecoUsd();
    await this.uow.transaction(async (tx) => {
      const r = this.reposEmTransacao(tx);
      for (const m of lista) {
        m.recalcularBrl(cot.valor, quando);
        const p = m.toProps();
        await r.materiais.update(m.id as number, { precoCustoBrl: p.precoCustoBrl, cotacaoUsada: p.cotacaoUsada, cotacaoEm: p.cotacaoEm });
      }
    });
    return {
      cotacao: cot,
      atualizados: lista.length,
      ignorados: await this.materiais.contarSemPrecoUsd(),
      avisos: cot.aviso ? [cot.aviso] : [],
    };
  }

  /** Valor total do estoque em USD e BRL (quantidade × custo), por categoria. */
  public async relatorio(): Promise<RelatorioEstoqueDTO> {
    const [porCategoria, cotacaoAtual] = await Promise.all([
      this.materiais.valorPorCategoria(),
      this.cotacao.obterCotacao().catch(() => null),
    ]);
    const soma = (f: (c: (typeof porCategoria)[number]) => number): number =>
      Math.round(porCategoria.reduce((acc, c) => acc + f(c), 0) * 100) / 100;
    return {
      geradoEm: DataHora.formatar(this.relogio()),
      totalItens: soma((c) => c.itens),
      itensEstoqueBaixo: soma((c) => c.estoqueBaixo),
      itensSemPreco: soma((c) => c.semPreco),
      valorTotalBrl: soma((c) => c.valorBrl),
      valorTotalUsd: soma((c) => c.valorUsd),
      porCategoria: porCategoria.map((c) => ({ categoria: c.categoria, itens: c.itens, valorBrl: c.valorBrl, valorUsd: c.valorUsd })),
      cotacaoAtual,
    };
  }

  /** Consumo (saídas) no período, por categoria e por material — base para estatísticas. */
  public async consumo(dataInicio: string, dataFim: string): Promise<ConsumoPeriodoDTO> {
    const { de, ate } = EstoqueService.periodo(dataInicio, dataFim, true);
    // Em sequência: usa uma conexão por vez do pool (servidores compartilhados limitam conexões).
    const porCategoria = await this.movimentacoes.consumo(de as Date, ate as Date, 'categoria');
    const porMaterial = await this.movimentacoes.consumo(de as Date, ate as Date, 'material');
    return {
      dataInicio,
      dataFim,
      porCategoria: porCategoria.map((c) => ({ chave: c.chave, rotulo: ROTULO_CATEGORIA[c.categoria] ?? c.rotulo, quantidade: c.quantidade, valorBrl: c.valorBrl })),
      porMaterial: porMaterial.map((c) => ({ chave: c.chave, rotulo: c.rotulo, quantidade: c.quantidade, valorBrl: c.valorBrl })),
      valorTotalBrl: Math.round(porCategoria.reduce((a, c) => a + c.valorBrl, 0) * 100) / 100,
    };
  }

  // ------------------------------------------------------------- regras internas

  /** Define (ou remove) o preço conforme a entrada; devolve avisos (ex.: cotação desatualizada). */
  private async aplicarPreco(material: Material, input: MaterialInput): Promise<string[]> {
    if (input.precoCusto === undefined) return [];
    if (input.precoCusto === null) {
      material.removerPreco();
      return [];
    }
    const cot = await this.cotacao.obterCotacao();
    material.definirPreco(input.precoCusto.moeda, input.precoCusto.valor, cot?.valor ?? null, cot ? DataHora.parse(cot.dataHora) : null);
    if (!cot) return ['Cotação do dólar indisponível: preço gravado só em BRL.'];
    return cot.aviso ? [cot.aviso] : [];
  }

  private async validarAgendamento(input: MovimentacaoInput, agendamentoId: number | null, autor: AutorMovimentacao): Promise<void> {
    if (autor.apenasConsumoProprio) {
      if (input.tipo !== 'SAIDA') throw new ForbiddenError('Profissionais só podem registrar saída (consumo) de material.');
      if (agendamentoId === null) throw new ValidationError('Informe o atendimento em que o material foi usado.', { agendamentoId: 'Obrigatório.' });
    }
    if (agendamentoId === null) return;
    if (input.tipo !== 'SAIDA') throw new ValidationError('Só saídas podem ser ligadas a um atendimento.');
    const ag = await this.movimentacoes.agendamentoDaSaida(agendamentoId);
    if (!ag || !ag.ativo) throw new NotFoundError('Agendamento', agendamentoId);
    if (ag.status === 'CANCELADO' || ag.status === 'FALTOU') {
      throw new ConflictError('Não é possível registrar consumo em um agendamento cancelado ou com falta.');
    }
    if (autor.apenasConsumoProprio && ag.profissionalId !== autor.usuarioId) {
      throw new ForbiddenError('Você só pode registrar consumo nos seus próprios atendimentos.');
    }
  }

  private async garantirNomeLivre(nome: string, ignorarId?: number): Promise<void> {
    const existente = await this.materiais.findByNome(nome);
    if (existente && existente.id !== ignorarId) throw new ConflictError('Já existe um material com este nome.');
  }

  private async materialOuFalhar(id: number): Promise<Material> {
    const m = await this.materiais.findById(id);
    if (!m) throw new NotFoundError('Material', id);
    return m;
  }

  /** Datas 'AAAA-MM-DD' (inclusivas) → intervalo [de, ate). */
  private static periodo(dataInicio: string | undefined, dataFim: string | undefined, obrigatorio: boolean): { de?: Date; ate?: Date } {
    const de = dataInicio ? DataHora.parseData(dataInicio) : null;
    const fim = dataFim ? DataHora.parseData(dataFim) : null;
    if ((dataInicio && !de) || (dataFim && !fim) || (obrigatorio && (!de || !fim))) {
      throw new ValidationError('Período inválido: use dataInicio e dataFim no formato AAAA-MM-DD.');
    }
    if (de && fim && de > fim) throw new ValidationError('A data inicial deve ser anterior à final.');
    return { de: de ?? undefined, ate: fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1) : undefined };
  }
}
