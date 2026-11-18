import type {
  AgendamentoInput,
  FiltroHistorico,
  PeriodoPayload,
  StatusAgendamentoValor,
} from '../../shared/agenda';
import { ValidationError } from '../core/entities';
import { Agendamento, DataHora } from '../core/entities/Agendamento';
import { BuscaAgendamentos } from '../core/repositories';
import { IpcEntrada } from './IpcEntrada';

/** Validação de formato dos payloads de agenda, histórico e estatísticas. */
export class IpcEntradaAgenda {
  public static agendamento(valor: unknown): AgendamentoInput {
    const d = IpcEntrada.objeto(valor, 'dados');
    if (d.confirmarFeriado !== undefined && typeof d.confirmarFeriado !== 'boolean') {
      throw new ValidationError('confirmarFeriado deve ser true ou false.');
    }
    return {
      clienteId: IpcEntrada.id(d.clienteId, 'clienteId'),
      profissionalId: IpcEntrada.id(d.profissionalId, 'profissionalId'),
      servicoId: IpcEntrada.id(d.servicoId, 'servicoId'),
      inicio: IpcEntrada.texto(d.inicio, 'inicio', 19),
      observacoes: IpcEntrada.textoOpcional(d.observacoes, 'observacoes'),
      confirmarFeriado: d.confirmarFeriado === true,
    };
  }

  public static editar(valor: unknown): { id: number; dados: AgendamentoInput } {
    const o = IpcEntrada.objeto(valor, 'payload');
    return { id: IpcEntrada.id(o.id), dados: IpcEntradaAgenda.agendamento(o.dados) };
  }

  public static cancelar(valor: unknown): { id: number; motivo: string | null } {
    const o = IpcEntrada.objeto(valor, 'payload');
    return { id: IpcEntrada.id(o.id), motivo: IpcEntrada.textoOpcional(o.motivo, 'motivo', 500) };
  }

  public static concluir(valor: unknown): { id: number; valorCobrado: number | null; observacoes: string | null } {
    const o = IpcEntrada.objeto(valor, 'payload');
    return {
      id: IpcEntrada.id(o.id),
      valorCobrado: o.valorCobrado === undefined || o.valorCobrado === null ? null : IpcEntrada.numero(o.valorCobrado, 'valorCobrado'),
      observacoes: IpcEntrada.textoOpcional(o.observacoes, 'observacoes', 500),
    };
  }

  /** Filtro da agenda → busca do repository (datas inclusivas viram intervalo [de, ate)). */
  public static filtroAgenda(valor: unknown): BuscaAgendamentos {
    if (valor === undefined || valor === null) return {};
    const o = IpcEntrada.objeto(valor, 'filtro');
    const busca: BuscaAgendamentos = {};
    if (o.profissionalId !== undefined) busca.profissionalId = IpcEntrada.id(o.profissionalId, 'profissionalId');
    if (o.clienteId !== undefined) busca.clienteId = IpcEntrada.id(o.clienteId, 'clienteId');
    const { de, ate } = IpcEntradaAgenda.datas(o.dataInicio, o.dataFim);
    busca.de = de;
    busca.ate = ate;
    if (o.status !== undefined) {
      if (!Array.isArray(o.status) || !o.status.every((s) => Agendamento.isStatus(s))) {
        throw new ValidationError('Filtro de status inválido.');
      }
      busca.status = o.status as StatusAgendamentoValor[];
    }
    if (o.ativo !== undefined) {
      if (o.ativo !== true && o.ativo !== false && o.ativo !== 'todos') throw new ValidationError('Filtro "ativo" inválido.');
      busca.ativo = o.ativo;
    }
    if (o.limit !== undefined) busca.limit = IpcEntrada.numero(o.limit, 'limit');
    if (o.offset !== undefined) busca.offset = IpcEntrada.numero(o.offset, 'offset');
    return busca;
  }

  public static filtroHistorico(valor: unknown): FiltroHistorico {
    if (valor === undefined || valor === null) return {};
    const o = IpcEntrada.objeto(valor, 'filtro');
    const filtro: FiltroHistorico = {};
    if (o.clienteId !== undefined) filtro.clienteId = IpcEntrada.id(o.clienteId, 'clienteId');
    if (o.profissionalId !== undefined) filtro.profissionalId = IpcEntrada.id(o.profissionalId, 'profissionalId');
    if (o.dataInicio !== undefined) filtro.dataInicio = IpcEntradaAgenda.data(o.dataInicio, 'dataInicio');
    if (o.dataFim !== undefined) filtro.dataFim = IpcEntradaAgenda.data(o.dataFim, 'dataFim');
    if (o.limit !== undefined) filtro.limit = IpcEntrada.numero(o.limit, 'limit');
    if (o.offset !== undefined) filtro.offset = IpcEntrada.numero(o.offset, 'offset');
    return filtro;
  }

  public static periodo(valor: unknown): PeriodoPayload {
    const o = IpcEntrada.objeto(valor, 'periodo');
    return {
      dataInicio: IpcEntradaAgenda.data(o.dataInicio, 'dataInicio'),
      dataFim: IpcEntradaAgenda.data(o.dataFim, 'dataFim'),
    };
  }

  public static data(valor: unknown, campo: string): string {
    const texto = IpcEntrada.texto(valor, campo, 10);
    if (!DataHora.parseData(texto)) {
      throw new ValidationError(`${campo} inválida (use AAAA-MM-DD).`, { [campo]: 'Data inválida.' });
    }
    return texto;
  }

  private static datas(dataInicio: unknown, dataFim: unknown): { de?: Date; ate?: Date } {
    const de = dataInicio === undefined ? undefined : DataHora.parseData(IpcEntradaAgenda.data(dataInicio, 'dataInicio')) ?? undefined;
    const fim = dataFim === undefined ? undefined : DataHora.parseData(IpcEntradaAgenda.data(dataFim, 'dataFim')) ?? undefined;
    if (de && fim && de > fim) throw new ValidationError('A data inicial deve ser anterior à final.');
    return { de, ate: fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1) : undefined };
  }
}
