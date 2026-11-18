import type { FetchFn } from './ViaCepClient';

/** Item retornado pela BrasilAPI: { date: 'AAAA-MM-DD', name: '...', type: 'national' }. */
interface FeriadoBrasilApi {
  date?: string;
  name?: string;
  type?: string;
}

export interface ConsultaFeriado {
  /** Nome do feriado nacional, ou null se não for feriado (ou se não deu para verificar). */
  feriado: string | null;
  /** false quando a API não respondeu: o resultado `feriado: null` não é garantido. */
  verificado: boolean;
}

/**
 * Feriados nacionais pela BrasilAPI (https://brasilapi.com.br/api/feriados/v1/{ano}).
 *
 * - Cache em memória por ano (a lista de um ano não muda durante o uso do app).
 * - Requisições simultâneas do mesmo ano compartilham a mesma chamada.
 * - Timeout e fallback: sem internet ou API fora do ar, nada é bloqueado;
 *   `ehFeriado` devolve null e `consultar` indica `verificado: false`.
 */
export class FeriadosClient {
  public static readonly URL_BASE = 'https://brasilapi.com.br/api/feriados/v1';
  public static readonly TIMEOUT_PADRAO_MS = 5000;

  private readonly cache = new Map<number, ReadonlyMap<string, string>>();
  private readonly emAndamento = new Map<number, Promise<ReadonlyMap<string, string> | null>>();

  constructor(
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
    private readonly timeoutMs: number = FeriadosClient.TIMEOUT_PADRAO_MS,
  ) {}

  /** Nome do feriado nacional na data, ou null (inclusive se a API falhar). */
  public async ehFeriado(data: Date): Promise<string | null> {
    return (await this.consultar(data)).feriado;
  }

  public async consultar(data: Date): Promise<ConsultaFeriado> {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
      return { feriado: null, verificado: false };
    }
    const feriados = await this.feriadosDoAno(data.getFullYear());
    if (!feriados) return { feriado: null, verificado: false };
    return { feriado: feriados.get(FeriadosClient.chave(data)) ?? null, verificado: true };
  }

  /** Lista do ano (data → nome), ou null se a API não respondeu. */
  public async feriadosDoAno(ano: number): Promise<ReadonlyMap<string, string> | null> {
    if (!Number.isInteger(ano) || ano < 1900 || ano > 2199) return null;
    const emCache = this.cache.get(ano);
    if (emCache) return emCache;

    let pendente = this.emAndamento.get(ano);
    if (!pendente) {
      pendente = this.buscarAno(ano).finally(() => this.emAndamento.delete(ano));
      this.emAndamento.set(ano, pendente);
    }
    return pendente;
  }

  /** Limpa o cache (ex.: testes). */
  public limparCache(): void {
    this.cache.clear();
  }

  private async buscarAno(ano: number): Promise<ReadonlyMap<string, string> | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resposta = await this.fetchFn(`${FeriadosClient.URL_BASE}/${ano}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!resposta.ok) return null;

      const corpo = await resposta.json();
      if (!Array.isArray(corpo)) return null;

      const mapa = new Map<string, string>();
      for (const item of corpo as FeriadoBrasilApi[]) {
        if (typeof item?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && typeof item.name === 'string') {
          mapa.set(item.date, item.name.trim());
        }
      }
      // Só guarda em cache respostas válidas; falhas tentam de novo na próxima consulta.
      this.cache.set(ano, mapa);
      return mapa;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private static chave(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
