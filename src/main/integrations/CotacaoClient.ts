import type { FetchFn } from './ViaCepClient';

/** Cotação USD→BRL retornada pela API. */
export interface CotacaoUsd {
  /** Valor de compra (bid): quantos reais vale 1 dólar. */
  valor: number;
  dataHora: Date;
}

interface RespostaAwesome {
  USDBRL?: {
    bid?: string;
    timestamp?: string;
    create_date?: string;
  };
}

/**
 * Cotação do dólar pela AwesomeAPI (https://economia.awesomeapi.com.br/json/last/USD-BRL).
 * Devolve o valor de compra (bid) e a data/hora da cotação, ou null em caso de
 * timeout, falta de internet, limite de requisições ou resposta inesperada.
 */
export class CotacaoClient {
  public static readonly URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
  public static readonly TIMEOUT_PADRAO_MS = 5000;

  constructor(
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
    private readonly timeoutMs: number = CotacaoClient.TIMEOUT_PADRAO_MS,
  ) {}

  public async buscar(): Promise<CotacaoUsd | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resposta = await this.fetchFn(CotacaoClient.URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!resposta.ok) return null;
      const dados = ((await resposta.json()) as RespostaAwesome)?.USDBRL;
      const valor = Number(dados?.bid);
      // Faixa de sanidade: evita gravar um valor absurdo vindo de resposta inesperada.
      if (!Number.isFinite(valor) || valor <= 0.5 || valor >= 50) return null;
      return { valor, dataHora: CotacaoClient.dataDaCotacao(dados?.timestamp, dados?.create_date) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** `timestamp` (segundos Unix) ou `create_date` ('AAAA-MM-DD HH:mm:ss', horário de Brasília). */
  private static dataDaCotacao(timestamp?: string, createDate?: string): Date {
    const ts = Number(timestamp);
    if (Number.isFinite(ts) && ts > 0) return new Date(ts * 1000);
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(createDate ?? '');
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-03:00`);
    return new Date();
  }
}
