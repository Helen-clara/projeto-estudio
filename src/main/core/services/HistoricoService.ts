import type { AtendimentoDTO, FiltroHistorico, HistoricoDTO } from '../../../shared/agenda';
import { NotFoundError, ValidationError } from '../entities';
import { DataHora } from '../entities/Agendamento';
import { AgendamentoDetalhado, AgendamentoRepository, BuscaAgendamentos, ClienteRepository } from '../repositories';

/**
 * Histórico de atendimentos = agendamentos CONCLUIDOS (com valor cobrado).
 * Consultas por cliente, por profissional e por período, sempre das mais recentes para as mais antigas.
 */
export class HistoricoService {
  constructor(
    private readonly agendamentos: AgendamentoRepository,
    private readonly clientes: ClienteRepository,
  ) {}

  public static toDTO(d: AgendamentoDetalhado): AtendimentoDTO {
    const a = d.agendamento;
    return {
      agendamentoId: a.id as number,
      data: DataHora.formatar(a.inicio),
      clienteId: a.clienteId,
      clienteNome: d.clienteNome,
      profissionalId: a.profissionalId,
      profissionalNome: d.profissionalNome,
      servicoId: a.servicoId,
      servicoNome: d.servicoNome,
      servicoCategoria: d.servicoCategoria,
      valorCobrado: a.valorCobrado ?? 0,
    };
  }

  public async porCliente(clienteId: number, filtro: FiltroHistorico = {}): Promise<HistoricoDTO> {
    if (!(await this.clientes.exists(clienteId))) throw new NotFoundError('Cliente', clienteId);
    return this.consultar({ ...filtro, clienteId });
  }

  public async porProfissional(profissionalId: number, filtro: FiltroHistorico = {}): Promise<HistoricoDTO> {
    return this.consultar({ ...filtro, profissionalId });
  }

  public async porPeriodo(dataInicio: string, dataFim: string, filtro: FiltroHistorico = {}): Promise<HistoricoDTO> {
    return this.consultar({ ...filtro, dataInicio, dataFim });
  }

  /** Consulta genérica (filtros combináveis). */
  public async consultar(filtro: FiltroHistorico): Promise<HistoricoDTO> {
    const busca = HistoricoService.busca(filtro);
    const [pagina, valorTotal] = await Promise.all([
      this.agendamentos.buscar(busca),
      this.agendamentos.somarValorCobrado({ ...busca, limit: undefined, offset: undefined }),
    ]);
    return {
      items: pagina.items.map(HistoricoService.toDTO),
      total: pagina.total,
      limit: pagina.limit,
      offset: pagina.offset,
      valorTotal,
    };
  }

  private static busca(filtro: FiltroHistorico): BuscaAgendamentos {
    const de = filtro.dataInicio ? DataHora.parseData(filtro.dataInicio) : null;
    const fim = filtro.dataFim ? DataHora.parseData(filtro.dataFim) : null;
    if (filtro.dataInicio && !de) throw new ValidationError('Data inicial inválida (use AAAA-MM-DD).');
    if (filtro.dataFim && !fim) throw new ValidationError('Data final inválida (use AAAA-MM-DD).');
    if (de && fim && de > fim) throw new ValidationError('A data inicial deve ser anterior à final.');

    return {
      clienteId: filtro.clienteId,
      profissionalId: filtro.profissionalId,
      de: de ?? undefined,
      // dataFim é inclusiva: busca até o início do dia seguinte.
      ate: fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1) : undefined,
      status: ['CONCLUIDO'],
      ordem: 'DESC',
      limit: filtro.limit,
      offset: filtro.offset,
    };
  }
}
