import type { TipoMovimentacaoValor } from '../../../shared/estoque';
import { ValidacaoCampos, ValidationError, textoOpcional } from './DomainErrors';
import { Material, arredondar } from './Material';

/**
 * A tabela `movimentacoes_estoque` só aceita ENTRADA e SAIDA. Um AJUSTE de inventário é gravado
 * como ENTRADA/SAIDA da diferença, com o motivo começando por este prefixo.
 */
export const PREFIXO_AJUSTE = 'AJUSTE:';

export interface MovimentacaoProps {
  materialId: number;
  tipo: TipoMovimentacaoValor;
  /** Quantidade movimentada (sempre > 0). */
  quantidade: number;
  /** +1 aumenta o saldo, -1 diminui (relevante para AJUSTE). */
  efeito: 1 | -1;
  motivo: string | null;
  agendamentoId: number | null;
  usuarioId: number | null;
  data: Date;
}

/** Linha como fica no banco (tipo físico ENTRADA/SAIDA). */
export interface MovimentacaoGravacao {
  materialId: number;
  tipoBanco: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  motivo: string | null;
  agendamentoId: number | null;
  usuarioId: number | null;
}

/** Entrada, saída ou ajuste de inventário de um material. */
export class MovimentacaoEstoque {
  private constructor(
    private readonly _id: number | null,
    private _props: MovimentacaoProps,
    private readonly _ativo: boolean,
  ) {}

  /**
   * Cria a movimentação a partir do pedido e do saldo atual do material.
   * Para AJUSTE, `quantidade` é o NOVO saldo contado; a diferença vira a movimentação.
   */
  public static registrar(
    material: Material,
    tipo: TipoMovimentacaoValor,
    quantidade: number,
    motivo: string | null | undefined,
    agendamentoId: number | null,
    usuarioId: number | null,
    agora: Date,
  ): MovimentacaoEstoque {
    const motivoLimpo = textoOpcional(motivo);
    new ValidacaoCampos()
      .check(tipo === 'ENTRADA' || tipo === 'SAIDA' || tipo === 'AJUSTE', 'tipo', 'Tipo deve ser ENTRADA, SAIDA ou AJUSTE.')
      .check(Material.quantidadeValida(quantidade), 'quantidade', 'Quantidade inválida (até 2 casas decimais).')
      .check(tipo === 'AJUSTE' || quantidade > 0, 'quantidade', 'Quantidade deve ser maior que zero.')
      .check(tipo !== 'AJUSTE' || (motivoLimpo?.length ?? 0) >= 3, 'motivo', 'Ajuste de inventário exige um motivo.')
      .check((motivoLimpo?.length ?? 0) <= 240, 'motivo', 'Motivo muito longo (máx. 240).')
      .check(agendamentoId === null || (Number.isInteger(agendamentoId) && agendamentoId > 0), 'agendamentoId', 'Agendamento inválido.')
      .throwIfAny();

    let qtd = quantidade;
    let efeito: 1 | -1 = tipo === 'SAIDA' ? -1 : 1;
    if (tipo === 'AJUSTE') {
      const diferenca = arredondar(quantidade - material.quantidadeAtual);
      if (diferenca === 0) throw new ValidationError('O saldo contado é igual ao atual: não há o que ajustar.');
      qtd = Math.abs(diferenca);
      efeito = diferenca > 0 ? 1 : -1;
    }

    return new MovimentacaoEstoque(
      null,
      { materialId: material.id as number, tipo, quantidade: qtd, efeito, motivo: motivoLimpo, agendamentoId, usuarioId, data: agora },
      true,
    );
  }

  /** Reconstrói a partir do banco, reconhecendo ajustes pelo prefixo do motivo. */
  public static restaurar(
    id: number,
    dados: MovimentacaoGravacao & { data: Date },
    ativo: boolean,
  ): MovimentacaoEstoque {
    const ajuste = dados.motivo?.startsWith(PREFIXO_AJUSTE) ?? false;
    return new MovimentacaoEstoque(
      id,
      {
        materialId: dados.materialId,
        tipo: ajuste ? 'AJUSTE' : dados.tipoBanco,
        quantidade: dados.quantidade,
        efeito: dados.tipoBanco === 'SAIDA' ? -1 : 1,
        motivo: ajuste ? dados.motivo?.slice(PREFIXO_AJUSTE.length).trim() || null : dados.motivo,
        agendamentoId: dados.agendamentoId,
        usuarioId: dados.usuarioId,
        data: dados.data,
      },
      ativo,
    );
  }

  public get id(): number | null { return this._id; }
  public get materialId(): number { return this._props.materialId; }
  public get tipo(): TipoMovimentacaoValor { return this._props.tipo; }
  public get quantidade(): number { return this._props.quantidade; }
  public get efeito(): 1 | -1 { return this._props.efeito; }
  public get motivo(): string | null { return this._props.motivo; }
  public get agendamentoId(): number | null { return this._props.agendamentoId; }
  public get usuarioId(): number | null { return this._props.usuarioId; }
  public get data(): Date { return new Date(this._props.data); }
  public get ativo(): boolean { return this._ativo; }

  /** Variação que esta movimentação causa no saldo. */
  public get variacao(): number {
    return this._props.quantidade * this._props.efeito;
  }

  public alterarMotivo(motivo: string | null): void {
    const m = textoOpcional(motivo);
    if (this.tipo === 'AJUSTE' && (m?.length ?? 0) < 3) throw new ValidationError('Ajuste de inventário exige um motivo.');
    if ((m?.length ?? 0) > 240) throw new ValidationError('Motivo muito longo (máx. 240).');
    this._props = { ...this._props, motivo: m };
  }

  /** Forma de gravação no banco (AJUSTE → ENTRADA/SAIDA com prefixo no motivo). */
  public paraGravacao(): MovimentacaoGravacao {
    const p = this._props;
    return {
      materialId: p.materialId,
      tipoBanco: p.efeito === 1 ? 'ENTRADA' : 'SAIDA',
      quantidade: p.quantidade,
      motivo: p.tipo === 'AJUSTE' ? `${PREFIXO_AJUSTE} ${p.motivo ?? ''}`.trim() : p.motivo,
      agendamentoId: p.agendamentoId,
      usuarioId: p.usuarioId,
    };
  }
}
