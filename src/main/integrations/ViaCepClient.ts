import type { ConsultaCepDTO } from '../../shared/dtos';
import { CepValidator } from '../core/validators';

/** Resposta da API ViaCEP (campos usados). Em CEP inexistente vem `{ "erro": true }`. */
interface ViaCepResposta {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

/** Assinatura mínima de fetch (permite injetar um fake nos testes). */
export type FetchFn = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Consulta de endereço pelo CEP na API pública ViaCEP (https://viacep.com.br).
 *
 * Nunca lança erro: CEP inválido, inexistente, timeout ou falta de internet
 * resultam em `{ encontrado: false, endereco: null, mensagem }`, para que o
 * cadastro do cliente continue com preenchimento manual.
 */
export class ViaCepClient {
  public static readonly URL_BASE = 'https://viacep.com.br/ws';
  public static readonly TIMEOUT_PADRAO_MS = 5000;

  constructor(
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
    private readonly timeoutMs: number = ViaCepClient.TIMEOUT_PADRAO_MS,
  ) {}

  public async buscar(cepInformado: string): Promise<ConsultaCepDTO> {
    const cep = CepValidator.normalize(cepInformado ?? '');
    if (!CepValidator.isValid(cep)) {
      return ViaCepClient.vazio('CEP inválido: informe 8 dígitos.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resposta = await this.fetchFn(`${ViaCepClient.URL_BASE}/${cep}/json/`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!resposta.ok) {
        return ViaCepClient.vazio(`Serviço de CEP indisponível (HTTP ${resposta.status}). Preencha o endereço manualmente.`);
      }

      const dados = (await resposta.json()) as ViaCepResposta;
      if (!dados || dados.erro === true || dados.erro === 'true') {
        return ViaCepClient.vazio('CEP não encontrado. Confira o número ou preencha o endereço manualmente.');
      }

      return {
        encontrado: true,
        endereco: {
          cep,
          logradouro: ViaCepClient.texto(dados.logradouro),
          numero: null,
          // O "complemento" do ViaCEP descreve a faixa de numeração da rua
          // (ex.: "de 612 a 1510 - lado par"), não o complemento do cliente.
          complemento: null,
          bairro: ViaCepClient.texto(dados.bairro),
          cidade: ViaCepClient.texto(dados.localidade),
          uf: ViaCepClient.texto(dados.uf)?.toUpperCase() ?? null,
        },
      };
    } catch {
      const timeout = controller.signal.aborted;
      return ViaCepClient.vazio(
        timeout
          ? 'A consulta de CEP demorou demais. Preencha o endereço manualmente.'
          : 'Não foi possível consultar o CEP (sem conexão?). Preencha o endereço manualmente.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private static vazio(mensagem: string): ConsultaCepDTO {
    return { encontrado: false, endereco: null, mensagem };
  }

  private static texto(valor: string | undefined): string | null {
    const t = valor?.trim();
    return t ? t : null;
  }
}
