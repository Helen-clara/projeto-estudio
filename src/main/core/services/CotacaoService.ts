import fs from 'fs';
import os from 'os';
import path from 'path';
import type { CotacaoDTO } from '../../../shared/estoque';
import { CotacaoClient, CotacaoUsd } from '../../integrations/CotacaoClient';
import { DataHora } from '../entities/Agendamento';

/** Fonte da última cotação gravada (ex.: a mais recente usada nos materiais do banco). */
export interface UltimaCotacaoGravada {
  ultimaCotacaoRegistrada(): Promise<CotacaoUsd | null>;
}

/**
 * Cotação USD→BRL com cache e fallback:
 *  1. cache em memória (15 min);
 *  2. AwesomeAPI (cada valor válido é salvo num arquivo local);
 *  3. se a API falhar: última cotação conhecida — memória, arquivo local ou banco —
 *     marcada como `desatualizada`, com aviso.
 * Devolve null só se nunca houve cotação alguma.
 */
export class CotacaoService {
  public static readonly VALIDADE_CACHE_MS = 15 * 60_000;
  private memoria: { cotacao: CotacaoUsd; obtidaEm: number } | null = null;

  constructor(
    private readonly client: CotacaoClient,
    private readonly banco: UltimaCotacaoGravada | null,
    private readonly arquivo: string = CotacaoService.arquivoPadrao(),
    private readonly agora: () => number = () => Date.now(),
  ) {}

  /** COTACAO_ARQUIVO no .env, ou ~/.ink-and-glow/cotacao-usd.json (fora do projeto e do Git). */
  public static arquivoPadrao(env: NodeJS.ProcessEnv = process.env): string {
    return env.COTACAO_ARQUIVO?.trim() || path.join(os.homedir(), '.ink-and-glow', 'cotacao-usd.json');
  }

  public async obterCotacao(): Promise<CotacaoDTO | null> {
    if (this.memoria && this.agora() - this.memoria.obtidaEm < CotacaoService.VALIDADE_CACHE_MS) {
      return CotacaoService.dto(this.memoria.cotacao, 'CACHE', false);
    }

    const daApi = await this.client.buscar();
    if (daApi) {
      this.memoria = { cotacao: daApi, obtidaEm: this.agora() };
      this.salvarArquivo(daApi);
      return CotacaoService.dto(daApi, 'API', false);
    }

    const aviso = 'Não foi possível consultar a AwesomeAPI agora: usando a última cotação conhecida, que pode estar desatualizada.';
    if (this.memoria) return CotacaoService.dto(this.memoria.cotacao, 'CACHE', true, aviso);
    const doArquivo = this.lerArquivo();
    if (doArquivo) return CotacaoService.dto(doArquivo, 'ARQUIVO', true, aviso);
    const doBanco = await this.banco?.ultimaCotacaoRegistrada().catch(() => null);
    if (doBanco) return CotacaoService.dto(doBanco, 'BANCO', true, aviso);
    return null;
  }

  /** Esquece o cache em memória (força nova consulta à API). */
  public invalidarCache(): void {
    this.memoria = null;
  }

  private salvarArquivo(c: CotacaoUsd): void {
    try {
      fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
      fs.writeFileSync(this.arquivo, JSON.stringify({ valor: c.valor, dataHora: c.dataHora.toISOString() }), 'utf8');
    } catch {
      // Sem permissão de escrita: segue só com memória/banco.
    }
  }

  private lerArquivo(): CotacaoUsd | null {
    try {
      const dados = JSON.parse(fs.readFileSync(this.arquivo, 'utf8')) as { valor?: unknown; dataHora?: unknown };
      const valor = Number(dados.valor);
      const dataHora = new Date(String(dados.dataHora));
      return Number.isFinite(valor) && valor > 0 && !Number.isNaN(dataHora.getTime()) ? { valor, dataHora } : null;
    } catch {
      return null;
    }
  }

  private static dto(c: CotacaoUsd, fonte: CotacaoDTO['fonte'], desatualizada: boolean, aviso?: string): CotacaoDTO {
    return {
      valor: Math.round(c.valor * 10_000) / 10_000,
      dataHora: DataHora.formatar(c.dataHora),
      fonte,
      desatualizada,
      ...(aviso ? { aviso: `${aviso} (cotação de ${DataHora.legivel(c.dataHora)})` } : {}),
    };
  }
}
