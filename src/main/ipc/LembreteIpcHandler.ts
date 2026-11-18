import type { CanalLembretes, FiltroLembretes } from '../../shared/lembretes';
import { ValidationError } from '../core/entities';
import { HandlerProtegido, IpcGuard, Permissao } from '../core/security';
import { IpcEntrada } from './IpcEntrada';
import { IpcEntradaAgenda } from './IpcEntradaAgenda';
import { IpcRegistrar } from './IpcRegistrar';
import { LembretesContainer } from './LembretesContainer';

const STATUS = ['PENDENTE', 'ENVIADO', 'FALHA'];

/**
 * Canais `lembretes:*`.
 * Listar e reenviar: ADMIN e RECEPCAO (LEMBRETES_GERENCIAR ou AGENDA_EDITAR).
 * Rodar agora e excluir: somente ADMIN (LEMBRETES_GERENCIAR).
 */
export class LembreteIpcHandler {
  constructor(
    private readonly container: LembretesContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalLembretes, permissoes: Permissao[], fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigirAlguma(permissoes, fn));
    const service = () => this.container.service;
    const RECEPCAO_OU_ADMIN = [Permissao.LEMBRETES_GERENCIAR, Permissao.AGENDA_EDITAR];
    const ADMIN = [Permissao.LEMBRETES_GERENCIAR];

    handle('lembretes:listar', RECEPCAO_OU_ADMIN, (p) => service().listar(LembreteIpcHandler.filtro(p)));
    handle('lembretes:reenviar', RECEPCAO_OU_ADMIN, (p) => service().reenviar(IpcEntrada.id(p)));
    handle('lembretes:excluir', ADMIN, (p) => service().excluir(IpcEntrada.id(p)));
    handle('lembretes:rodarAgora', ADMIN, () => service().processarLembretesDoDiaSeguinte());
  }

  private static filtro(valor: unknown): FiltroLembretes {
    if (valor === undefined || valor === null) return {};
    const o = IpcEntrada.objeto(valor, 'filtro');
    const filtro: FiltroLembretes = {};
    if (o.status !== undefined && o.status !== null && o.status !== '') {
      if (typeof o.status !== 'string' || !STATUS.includes(o.status)) throw new ValidationError('Status de lembrete inválido.');
      filtro.status = o.status as FiltroLembretes['status'];
    }
    if (o.agendamentoId !== undefined) filtro.agendamentoId = IpcEntrada.id(o.agendamentoId, 'agendamentoId');
    if (o.dataInicio !== undefined) filtro.dataInicio = IpcEntradaAgenda.data(o.dataInicio, 'dataInicio');
    if (o.dataFim !== undefined) filtro.dataFim = IpcEntradaAgenda.data(o.dataFim, 'dataFim');
    if (o.ativo !== undefined) {
      if (o.ativo !== true && o.ativo !== false && o.ativo !== 'todos') throw new ValidationError('Filtro "ativo" inválido.');
      filtro.ativo = o.ativo;
    }
    if (o.limit !== undefined) filtro.limit = IpcEntrada.numero(o.limit, 'limit');
    if (o.offset !== undefined) filtro.offset = IpcEntrada.numero(o.offset, 'offset');
    return filtro;
  }
}
