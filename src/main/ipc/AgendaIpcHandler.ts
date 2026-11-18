import type { CanalAgenda } from '../../shared/agenda';
import { DataHora } from '../core/entities/Agendamento';
import {
  ForbiddenError,
  HandlerProtegido,
  IpcGuard,
  PERMISSOES_POR_PERFIL,
  Permissao,
  UsuarioSessao,
} from '../core/security';
import { AgendamentoService } from '../core/services';
import { AgendaContainer } from './AgendaContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcEntradaAgenda } from './IpcEntradaAgenda';
import { IpcRegistrar } from './IpcRegistrar';

const P = Permissao;

function tem(usuario: UsuarioSessao, permissao: Permissao): boolean {
  return PERMISSOES_POR_PERFIL[usuario.perfil]?.has(permissao) ?? false;
}

/**
 * Canais `agenda:*`.
 * Quem tem AGENDA_VER_TODOS / AGENDA_EDITAR (ADMIN, RECEPCAO) atua em qualquer agenda;
 * quem só tem as permissões "própria" (PROFISSIONAL) só vê e altera a própria agenda.
 */
export class AgendaIpcHandler {
  constructor(
    private readonly container: AgendaContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalAgenda, permissoes: Permissao[], fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigirAlguma(permissoes, fn));
    const service = () => this.container.agenda;
    const VER = [P.AGENDA_VER_TODOS, P.AGENDA_VER_PROPRIA];
    const ALTERAR = [P.AGENDA_EDITAR, P.AGENDA_GERENCIAR_PROPRIA];

    handle('agenda:listar', VER, (p, u) => {
      const busca = IpcEntradaAgenda.filtroAgenda(p);
      if (!tem(u, P.AGENDA_VER_TODOS)) busca.profissionalId = u.id;
      return service().listar(busca);
    });

    handle('agenda:obter', VER, async (p, u) => {
      const dto = await service().obter(IpcEntrada.id(p));
      AgendaIpcHandler.exigirPropria(u, dto.profissionalId, P.AGENDA_VER_TODOS);
      return dto;
    });

    handle('agenda:verificarFeriado', VER, (p) => {
      const data = DataHora.parseData(IpcEntradaAgenda.data(p, 'data')) as Date;
      return service().verificarFeriado(data);
    });

    handle('agenda:criar', ALTERAR, (p, u) => {
      const input = IpcEntradaAgenda.agendamento(p);
      AgendaIpcHandler.exigirPropria(u, input.profissionalId, P.AGENDA_EDITAR);
      return service().criar(AgendamentoService.converterEntrada(input));
    });

    handle('agenda:editar', ALTERAR, async (p, u) => {
      const { id, dados } = IpcEntradaAgenda.editar(p);
      AgendaIpcHandler.exigirPropria(u, await service().profissionalDoAgendamento(id), P.AGENDA_EDITAR);
      AgendaIpcHandler.exigirPropria(u, dados.profissionalId, P.AGENDA_EDITAR);
      return service().editar(id, AgendamentoService.converterEntrada(dados));
    });

    handle('agenda:confirmar', ALTERAR, async (p, u) => {
      const id = IpcEntrada.id(p);
      await this.exigirAgendamentoProprio(u, id, P.AGENDA_EDITAR);
      return service().confirmar(id);
    });

    handle('agenda:cancelar', ALTERAR, async (p, u) => {
      const { id, motivo } = IpcEntradaAgenda.cancelar(p);
      await this.exigirAgendamentoProprio(u, id, P.AGENDA_EDITAR);
      return service().cancelar(id, motivo);
    });

    handle('agenda:marcarFalta', ALTERAR, async (p, u) => {
      const id = IpcEntrada.id(p);
      await this.exigirAgendamentoProprio(u, id, P.AGENDA_EDITAR);
      return service().marcarFalta(id);
    });

    // Concluir: ADMIN conclui qualquer um; PROFISSIONAL só os próprios. RECEPCAO não conclui.
    handle('agenda:concluir', [P.ATENDIMENTO_CONCLUIR], async (p, u) => {
      const { id, valorCobrado, observacoes } = IpcEntradaAgenda.concluir(p);
      await this.exigirAgendamentoProprio(u, id, P.AGENDA_VER_TODOS);
      return service().concluir(id, valorCobrado, observacoes);
    });

    handle('agenda:excluir', [P.AGENDA_EDITAR], (p) => service().excluir(IpcEntrada.id(p)));
  }

  private async exigirAgendamentoProprio(u: UsuarioSessao, agendamentoId: number, permissaoGeral: Permissao): Promise<void> {
    if (tem(u, permissaoGeral)) return;
    AgendaIpcHandler.exigirPropria(u, await this.container.agenda.profissionalDoAgendamento(agendamentoId), permissaoGeral);
  }

  /** Sem a permissão geral, o usuário só pode atuar sobre a própria agenda. */
  private static exigirPropria(u: UsuarioSessao, profissionalId: number, permissaoGeral: Permissao): void {
    if (!tem(u, permissaoGeral) && profissionalId !== u.id) {
      throw new ForbiddenError('Você só pode acessar a sua própria agenda.');
    }
  }
}
