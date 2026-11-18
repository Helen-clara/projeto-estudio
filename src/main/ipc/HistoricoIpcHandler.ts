import type { CanalAgenda, FiltroHistorico } from '../../shared/agenda';
import {
  ForbiddenError,
  HandlerProtegido,
  IpcGuard,
  PERMISSOES_POR_PERFIL,
  Permissao,
  UsuarioSessao,
} from '../core/security';
import { AgendaContainer } from './AgendaContainer';
import { IpcEntrada } from './IpcEntrada';
import { IpcEntradaAgenda } from './IpcEntradaAgenda';
import { IpcRegistrar } from './IpcRegistrar';

/**
 * Canais `historico:*` e `estatisticas:resumo`.
 * HISTORICO_VER_TODOS vê tudo; HISTORICO_VER_PROPRIOS_CLIENTES (profissional)
 * vê apenas os atendimentos que ele mesmo realizou.
 */
export class HistoricoIpcHandler {
  constructor(
    private readonly container: AgendaContainer,
    private readonly ipc: IpcRegistrar,
    private readonly guard: IpcGuard,
  ) {}

  public registrar(): void {
    const handle = <T>(canal: CanalAgenda, permissoes: Permissao[], fn: HandlerProtegido<T>) =>
      this.ipc.handle(canal, this.guard.exigirAlguma(permissoes, fn));
    const historico = () => this.container.historico;
    const VER = [Permissao.HISTORICO_VER_TODOS, Permissao.HISTORICO_VER_PROPRIOS_CLIENTES];

    handle('historico:porCliente', VER, (p, u) => {
      const o = IpcEntrada.objeto(p, 'payload');
      const clienteId = IpcEntrada.id(o.clienteId, 'clienteId');
      return historico().porCliente(clienteId, HistoricoIpcHandler.escopo(u, IpcEntradaAgenda.filtroHistorico(o)));
    });

    handle('historico:porProfissional', VER, (p, u) => {
      const o = IpcEntrada.objeto(p, 'payload');
      const profissionalId = IpcEntrada.id(o.profissionalId, 'profissionalId');
      if (!HistoricoIpcHandler.verTodos(u) && profissionalId !== u.id) {
        throw new ForbiddenError('Você só pode consultar o seu próprio histórico de atendimentos.');
      }
      return historico().porProfissional(profissionalId, IpcEntradaAgenda.filtroHistorico(o));
    });

    handle('historico:porPeriodo', VER, (p, u) => {
      const filtro = IpcEntradaAgenda.filtroHistorico(p);
      const periodo = IpcEntradaAgenda.periodo(p);
      return historico().porPeriodo(periodo.dataInicio, periodo.dataFim, HistoricoIpcHandler.escopo(u, filtro));
    });

    this.ipc.handle(
      'estatisticas:resumo',
      this.guard.exigir(Permissao.RELATORIOS_VER, (p) => this.container.estatisticas.resumo(IpcEntradaAgenda.periodo(p))),
    );
  }

  private static verTodos(u: UsuarioSessao): boolean {
    return PERMISSOES_POR_PERFIL[u.perfil]?.has(Permissao.HISTORICO_VER_TODOS) ?? false;
  }

  /** Sem HISTORICO_VER_TODOS, força o filtro para os atendimentos do próprio profissional. */
  private static escopo(u: UsuarioSessao, filtro: FiltroHistorico): FiltroHistorico {
    return HistoricoIpcHandler.verTodos(u) ? filtro : { ...filtro, profissionalId: u.id };
  }
}
