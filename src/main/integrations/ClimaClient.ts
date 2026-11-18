import type { FetchFn } from './ViaCepClient';

/** Previsão de um dia na localização do estúdio. */
export interface PrevisaoClima {
  /** 'AAAA-MM-DD' */
  data: string;
  temperaturaMax: number | null;
  temperaturaMin: number | null;
  /** 0–100 */
  chanceChuva: number | null;
  indiceUV: number | null;
}

interface RespostaOpenMeteo {
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    uv_index_max?: (number | null)[];
  };
}

export interface LocalizacaoEstudio {
  latitude: number;
  longitude: number;
}

/**
 * Previsão do tempo pela API Open-Meteo (https://api.open-meteo.com/v1/forecast), sem chave.
 * A localização vem do .env (CLIMA_LATITUDE/CLIMA_LONGITUDE; padrão: São Paulo/SP).
 *
 * Fallback silencioso: datas fora da janela de previsão (~16 dias), timeout,
 * falta de internet ou resposta inesperada devolvem null — o lembrete sai sem a dica de clima.
 */
export class ClimaClient {
  public static readonly URL_BASE = 'https://api.open-meteo.com/v1/forecast';
  public static readonly TIMEOUT_PADRAO_MS = 5000;
  public static readonly LOCAL_PADRAO: LocalizacaoEstudio = { latitude: -23.5505, longitude: -46.6333 };

  private readonly cache = new Map<string, { previsao: PrevisaoClima | null; expiraEm: number }>();

  constructor(
    private readonly local: LocalizacaoEstudio = ClimaClient.localDoAmbiente(),
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
    private readonly timeoutMs: number = ClimaClient.TIMEOUT_PADRAO_MS,
  ) {}

  public static localDoAmbiente(env: NodeJS.ProcessEnv = process.env): LocalizacaoEstudio {
    const latitude = Number(env.CLIMA_LATITUDE);
    const longitude = Number(env.CLIMA_LONGITUDE);
    const valido = env.CLIMA_LATITUDE?.trim() && env.CLIMA_LONGITUDE?.trim() &&
      Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
    return valido ? { latitude, longitude } : ClimaClient.LOCAL_PADRAO;
  }

  /** Previsão do dia (data local). Cache de 1 hora por data. */
  public async previsao(data: Date): Promise<PrevisaoClima | null> {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
    const dia = ClimaClient.dia(data);
    const emCache = this.cache.get(dia);
    if (emCache && emCache.expiraEm > Date.now()) return emCache.previsao;

    const previsao = await this.buscar(dia);
    // Falhas ficam em cache por menos tempo para tentar de novo logo.
    this.cache.set(dia, { previsao, expiraEm: Date.now() + (previsao ? 60 : 5) * 60_000 });
    return previsao;
  }

  private async buscar(dia: string): Promise<PrevisaoClima | null> {
    const params = new URLSearchParams({
      latitude: String(this.local.latitude),
      longitude: String(this.local.longitude),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
      timezone: 'auto',
      start_date: dia,
      end_date: dia,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resposta = await this.fetchFn(`${ClimaClient.URL_BASE}?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!resposta.ok) return null; // ex.: 400 para datas fora da janela de previsão
      const corpo = (await resposta.json()) as RespostaOpenMeteo;
      const d = corpo?.daily;
      const i = d?.time?.indexOf(dia) ?? -1;
      if (!d || i < 0) return null;
      return {
        data: dia,
        temperaturaMax: ClimaClient.numero(d.temperature_2m_max?.[i]),
        temperaturaMin: ClimaClient.numero(d.temperature_2m_min?.[i]),
        chanceChuva: ClimaClient.numero(d.precipitation_probability_max?.[i]),
        indiceUV: ClimaClient.numero(d.uv_index_max?.[i]),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private static numero(v: number | null | undefined): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  private static dia(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
