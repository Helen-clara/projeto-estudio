import { Database } from '../core/database/Database';
import { ClienteRepository, ProfissionalRepository, ServicoRepository } from '../core/repositories';
import { BcryptSenhaHasher, ClienteService, ProfissionalService, ServicoService } from '../core/services';
import { ViaCepClient } from '../integrations/ViaCepClient';

/**
 * Monta (injeção de dependência via construtor) os services de cadastro.
 * Criação preguiçosa: o banco só é acessado na primeira chamada, então o app
 * abre mesmo sem .env configurado e o erro chega à tela como mensagem.
 */
export class CadastrosContainer {
  private _clientes: ClienteService | null = null;
  private _servicos: ServicoService | null = null;
  private _profissionais: ProfissionalService | null = null;

  public get clientes(): ClienteService {
    this._clientes ??= new ClienteService(new ClienteRepository(this.db()), new ViaCepClient());
    return this._clientes;
  }

  public get servicos(): ServicoService {
    this._servicos ??= new ServicoService(new ServicoRepository(this.db()));
    return this._servicos;
  }

  public get profissionais(): ProfissionalService {
    if (!this._profissionais) {
      const db = this.db();
      this._profissionais = new ProfissionalService(
        new ProfissionalRepository(db),
        new ServicoRepository(db),
        new BcryptSenhaHasher(),
        db,
      );
    }
    return this._profissionais;
  }

  private db(): Database {
    return Database.getInstance();
  }
}
