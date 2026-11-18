import { Database } from '../core/database/Database';
import { MaterialRepository, MovimentacaoRepository } from '../core/repositories';
import { CotacaoService, EstoqueService } from '../core/services';
import { CotacaoClient } from '../integrations/CotacaoClient';

/** Monta (preguiçosamente) o EstoqueService com a cotação compartilhada. */
export class EstoqueContainer {
  private _estoque: EstoqueService | null = null;

  public get estoque(): EstoqueService {
    if (!this._estoque) {
      const db = Database.getInstance();
      const materiais = new MaterialRepository(db);
      const cotacao = new CotacaoService(new CotacaoClient(), materiais);
      this._estoque = new EstoqueService(materiais, new MovimentacaoRepository(db), cotacao, db);
    }
    return this._estoque;
  }
}
