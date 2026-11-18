import { Database } from '../core/database/Database';
import { LembreteRepository } from '../core/repositories/LembreteRepository';
import { AgendadorService, LembreteService, NotificacaoEmailService } from '../core/services';
import { ClimaClient } from '../integrations/ClimaClient';

/** Monta o LembreteService e o agendador (criação preguiçosa). */
export class LembretesContainer {
  private _service: LembreteService | null = null;
  private _agendador: AgendadorService | null = null;

  public get service(): LembreteService {
    this._service ??= new LembreteService(
      new LembreteRepository(Database.getInstance()),
      new NotificacaoEmailService(),
      new ClimaClient(),
    );
    return this._service;
  }

  public get agendador(): AgendadorService {
    this._agendador ??= new AgendadorService(() => this.service.processarLembretesDoDiaSeguinte());
    return this._agendador;
  }
}
