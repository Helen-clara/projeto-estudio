import type { EnderecoDTO } from '../../../shared/dtos';
import { CepValidator } from '../validators';
import { ValidacaoCampos, textoOpcional } from './DomainErrors';

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

/** Endereço (value object imutável): dois endereços com os mesmos dados são iguais. */
export class Endereco {
  private readonly _cep: string;
  private readonly _logradouro: string | null;
  private readonly _numero: string | null;
  private readonly _complemento: string | null;
  private readonly _bairro: string | null;
  private readonly _cidade: string | null;
  private readonly _uf: string | null;

  constructor(dados: EnderecoDTO) {
    const cep = CepValidator.normalize(dados.cep ?? '');
    const uf = textoOpcional(dados.uf)?.toUpperCase() ?? null;
    const logradouro = textoOpcional(dados.logradouro);
    const numero = textoOpcional(dados.numero);
    const complemento = textoOpcional(dados.complemento);
    const bairro = textoOpcional(dados.bairro);
    const cidade = textoOpcional(dados.cidade);

    new ValidacaoCampos()
      .check(CepValidator.isValid(cep), 'endereco.cep', 'CEP deve ter 8 dígitos.')
      .check(uf === null || UFS.has(uf), 'endereco.uf', 'UF inválida.')
      .check((logradouro?.length ?? 0) <= 150, 'endereco.logradouro', 'Logradouro muito longo (máx. 150).')
      .check((numero?.length ?? 0) <= 10, 'endereco.numero', 'Número muito longo (máx. 10).')
      .check((complemento?.length ?? 0) <= 80, 'endereco.complemento', 'Complemento muito longo (máx. 80).')
      .check((bairro?.length ?? 0) <= 80, 'endereco.bairro', 'Bairro muito longo (máx. 80).')
      .check((cidade?.length ?? 0) <= 80, 'endereco.cidade', 'Cidade muito longa (máx. 80).')
      .throwIfAny();

    this._cep = cep;
    this._logradouro = logradouro;
    this._numero = numero;
    this._complemento = complemento;
    this._bairro = bairro;
    this._cidade = cidade;
    this._uf = uf;
  }

  public get cep(): string { return this._cep; }
  public get logradouro(): string | null { return this._logradouro; }
  public get numero(): string | null { return this._numero; }
  public get complemento(): string | null { return this._complemento; }
  public get bairro(): string | null { return this._bairro; }
  public get cidade(): string | null { return this._cidade; }
  public get uf(): string | null { return this._uf; }

  /** Novo endereço com número/complemento alterados (o resto vem do CEP). */
  public comNumero(numero: string | null, complemento: string | null = this._complemento): Endereco {
    return new Endereco({ ...this.toDTO(), numero, complemento });
  }

  public equals(outro: Endereco | null): boolean {
    return outro !== null && JSON.stringify(this.toDTO()) === JSON.stringify(outro.toDTO());
  }

  public toDTO(): EnderecoDTO {
    return {
      cep: this._cep,
      logradouro: this._logradouro,
      numero: this._numero,
      complemento: this._complemento,
      bairro: this._bairro,
      cidade: this._cidade,
      uf: this._uf,
    };
  }
}
