import type { CategoriaValor } from '../../shared/dtos';
import type {
  CanalEstoque,
  FiltroMateriais,
  FiltroMovimentacoes,
  MaterialInput,
  MovimentacaoInput,
  PrecoCustoInput,
  TipoMovimentacaoValor,
} from '../../shared/estoque';
import { Servico, ValidationError } from '../core/entities';
import { HandlerProtegido, IpcGuard, PERMISSOES_POR_PERFIL, Permissao } from '../core/security';
import { EstoqueContainer } from './EstoqueContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcEntradaAgenda } from './IpcEntradaAgenda';
import { IpcRegistrar } from './IpcRegistrar';

type Objeto = Record<string, unknown>;
const TIPOS: readonly TipoMovimentacaoValor[] = ['ENTRADA', 'SAIDA', 'AJUSTE'];

/** Validação de formato dos payloads do estoque. */
class IpcEntradaEstoque {
  public static material(valor: unknown): { id?: number; dados: MaterialInput } {
    const { id, dados: d } = IpcEntrada.salvar(valor);
    if (!Servico.isCategoria(d.categoria)) {
      throw new ValidationError('Categoria deve ser TATUAGEM ou ESTETICA.', { categoria: 'Categoria inválida.' });
    }
    const dados: MaterialInput = {
      nome: IpcEntrada.texto(d.nome, 'nome', 120),
      categoria: d.categoria as CategoriaValor,
      unidade: IpcEntrada.texto(d.unidade, 'unidade', 20),
      estoqueMinimo: IpcEntrada.numero(d.estoqueMinimo, 'estoqueMinimo'),
      fornecedor: IpcEntrada.textoOpcional(d.fornecedor, 'fornecedor', 120),
    };
    if (d.precoCusto !== undefined) dados.precoCusto = d.precoCusto === null ? null : IpcEntradaEstoque.preco(d.precoCusto);
    if (d.quantidadeInicial !== undefined && d.quantidadeInicial !== null) {
      if (id !== undefined) throw new ValidationError('A quantidade só muda por movimentação (entrada, saída ou ajuste).');
      dados.quantidadeInicial = IpcEntrada.numero(d.quantidadeInicial, 'quantidadeInicial');
    }
    return { id, dados };
  }

  public static preco(valor: unknown): PrecoCustoInput {
    const p = IpcEntrada.objeto(valor, 'precoCusto');
    if (p.moeda !== 'USD' && p.moeda !== 'BRL') throw new ValidationError('Moeda deve ser USD ou BRL.', { 'precoCusto.moeda': 'Moeda inválida.' });
    return { moeda: p.moeda, valor: IpcEntrada.numero(p.valor, 'precoCusto.valor') };
  }

  public static movimentacao(valor: unknown): MovimentacaoInput {
    const o = IpcEntrada.objeto(valor, 'movimentacao');
    if (!TIPOS.includes(o.tipo as TipoMovimentacaoValor)) throw new ValidationError('Tipo deve ser ENTRADA, SAIDA ou AJUSTE.', { tipo: 'Tipo inválido.' });
    return {
      materialId: IpcEntrada.id(o.materialId, 'materialId'),
      tipo: o.tipo as TipoMovimentacaoValor,
      quantidade: IpcEntrada.numero(o.quantidade, 'quantidade'),
      motivo: IpcEntrada.textoOpcional(o.motivo, 'motivo', 240),
      agendamentoId: IpcEntrada.idOpcional(o.agendamentoId, 'agendamentoId') ?? null,
    };
  }

  public static filtroMateriais(valor: unknown): FiltroMateriais {
    const filtro: FiltroMateriais = IpcEntrada.filtroListagem(valor);
    const o = (valor ?? {}) as Objeto;
    if (o.categoria !== undefined && o.categoria !== null && o.categoria !== '') {
      if (!Servico.isCategoria(o.categoria)) throw new ValidationError('Categoria inválida.');
      filtro.categoria = o.categoria as CategoriaValor;
    }
    if (o.apenasEstoqueBaixo !== undefined) {
      if (typeof o.apenasEstoqueBaixo !== 'boolean') throw new ValidationError('apenasEstoqueBaixo deve ser true ou false.');
      filtro.apenasEstoqueBaixo = o.apenasEstoqueBaixo;
    }
    return filtro;
  }

  public static filtroMovimentacoes(valor: unknown): FiltroMovimentacoes {
    if (valor === undefined || valor === null) return {};
    const o = IpcEntrada.objeto(valor, 'filtro');
    const f: FiltroMovimentacoes = {};
    if (o.materialId !== undefined) f.materialId = IpcEntrada.id(o.materialId, 'materialId');
    if (o.agendamentoId !== undefined) f.agendamentoId = IpcEntrada.id(o.agendamentoId, 'agendamentoId');
    if (o.tipo !== undefined && o.tipo !== '') {
      if (!TIPOS.includes(o.tipo as TipoMovimentacaoValor)) throw new ValidationError('Tipo inválido.');
      f.tipo = o.tipo as TipoMovimentacaoValor;
    }
    if (o.dataInicio !== undefined) f.dataInicio = IpcEntradaAgenda.data(o.dataInicio, 'dataInicio');
    if (o.dataFim !== undefined) f.dataFim = IpcEntradaAgenda.data(o.dataFim, 'dataFim');
    if (o.ativo !== undefined) {
      if (o.ativo !== true && o.ativo !== false && o.ativo !== 'todos') throw new ValidationError('Filtro "ativo" inválido.');
      f.ativo = o.ativo;
    }
    if (o.limit !== undefined) f.limit = IpcEntrada.numero(o.limit, 'limit');
    if (o.offset !== undefined) f.offset = IpcEntrada.numero(o.offset, 'offset');
    return f;
  }
}

/**
 * Canais `estoque:*`.
 * Consultar: ESTOQUE_VER (todos os perfis; recepção só consulta).
 * Cadastrar/editar/inativar, recalcular preços e estornar: ESTOQUE_EDITAR (ADMIN).
 * Movimentar: ADMIN qualquer tipo; PROFISSIONAL só SAÍDA ligada a atendimento próprio (ESTOQUE_REGISTRAR_CONSUMO).
 * Consumo por período: RELATORIOS_VER ou ESTOQUE_EDITAR.
 */
export class EstoqueIpcHandler {
  constructor(
    private readonly container: EstoqueContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalEstoque, permissoes: Permissao[], fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigirAlguma(permissoes, fn));
    const s = () => this.container.estoque;
    const VER = [Permissao.ESTOQUE_VER];
    const EDITAR = [Permissao.ESTOQUE_EDITAR];

    handle('estoque:listar', VER, (p) => s().listar(IpcEntradaEstoque.filtroMateriais(p)));
    handle('estoque:obter', VER, (p) => s().obter(IpcEntrada.id(p)));
    handle('estoque:alertas', VER, () => s().alertas());
    handle('estoque:cotacaoAtual', VER, () => s().cotacaoAtual());
    handle('estoque:relatorio', VER, () => s().relatorio());
    handle('estoque:movimentacoes', VER, (p) => s().listarMovimentacoes(IpcEntradaEstoque.filtroMovimentacoes(p)));

    handle('estoque:salvar', EDITAR, (p, u) => {
      const { id, dados } = IpcEntradaEstoque.material(p);
      return id === undefined ? s().criar(dados, u.id) : s().atualizar(id, dados);
    });
    handle('estoque:inativar', EDITAR, (p) => s().inativar(IpcEntrada.id(p)));
    handle('estoque:reativar', EDITAR, (p) => s().reativar(IpcEntrada.id(p)));
    handle('estoque:recalcularPrecos', EDITAR, () => s().recalcularPrecos());
    handle('estoque:estornar', EDITAR, (p) => s().estornar(IpcEntrada.id(p)));
    handle('estoque:editarMotivo', EDITAR, (p) => {
      const o = IpcEntrada.objeto(p, 'payload');
      return s().editarMotivo(IpcEntrada.id(o.id), IpcEntrada.textoOpcional(o.motivo, 'motivo', 240));
    });

    handle('estoque:movimentar', [Permissao.ESTOQUE_EDITAR, Permissao.ESTOQUE_REGISTRAR_CONSUMO], (p, u) => {
      const podeEditar = PERMISSOES_POR_PERFIL[u.perfil]?.has(Permissao.ESTOQUE_EDITAR) ?? false;
      return s().movimentar(IpcEntradaEstoque.movimentacao(p), { usuarioId: u.id, apenasConsumoProprio: !podeEditar });
    });

    handle('estoque:consumo', [Permissao.RELATORIOS_VER, Permissao.ESTOQUE_EDITAR], (p) => {
      const periodo = IpcEntradaAgenda.periodo(p);
      return s().consumo(periodo.dataInicio, periodo.dataFim);
    });
  }
}
