import { Database } from '../core/database/Database';
import {
  AgendamentoRepository,
  ClienteRepository,
  ProfissionalRepository,
  ServicoRepository,
} from '../core/repositories';
import { AgendamentoService, EstatisticasService, HistoricoService } from '../core/services';
import { FeriadosClient } from '../integrations/FeriadosClient';

/** Monta (preguiçosamente) os services de agenda, histórico e estatísticas. */
export class AgendaContainer {
  private readonly feriados = new FeriadosClient();
  private _agenda: AgendamentoService | null = null;
  private _historico: HistoricoService | null = null;
  private _estatisticas: EstatisticasService | null = null;

  public get agenda(): AgendamentoService {
    if (!this._agenda) {
      const db = Database.getInstance();
      this._agenda = new AgendamentoService(
        new AgendamentoRepository(db),
        new ClienteRepository(db),
        new ProfissionalRepository(db),
        new ServicoRepository(db),
        this.feriados,
        db,
      );
    }
    return this._agenda;
  }

  public get historico(): HistoricoService {
    const db = () => Database.getInstance();
    this._historico ??= new HistoricoService(new AgendamentoRepository(db()), new ClienteRepository(db()));
    return this._historico;
  }

  public get estatisticas(): EstatisticasService {
    this._estatisticas ??= new EstatisticasService(Database.getInstance());
    return this._estatisticas;
  }
}
