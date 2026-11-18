import { RowDataPacket } from 'mysql2/promise';
import type {
  ContagemValorDTO,
  EstatisticasResumoDTO,
  PeriodoPayload,
  StatusAgendamentoValor,
} from '../../../shared/agenda';
import { SqlExecutor, SqlParam } from '../database/Database';
import { ValidationError } from '../entities';
import { DataHora } from '../entities/Agendamento';

/** Filtro base de atendimentos concluídos no período [de, ate). */
const CONCLUIDOS_NO_PERIODO =
  "a.ativo = 1 AND a.status = 'CONCLUIDO' AND a.data_hora_inicio >= ? AND a.data_hora_inicio < ?";

const MAX_DIAS_PERIODO = 366 * 5;

/**
 * Base para relatórios/estatísticas futuros: somente consultas SQL agregadas
 * (GROUP BY, SUM, COUNT) e parametrizadas sobre `agendamentos`.
 */
export class EstatisticasService {
  constructor(private readonly db: SqlExecutor) {}

  public async resumo(periodo: PeriodoPayload): Promise<EstatisticasResumoDTO> {
    const { de, ate } = EstatisticasService.intervalo(periodo);
    const p: SqlParam[] = [de, ate];

    const [totais, porMes, porServico, porProfissional, porStatus, clientes] = await Promise.all([
      this.db.query<RowDataPacket>(
        `SELECT COUNT(*) AS atendimentos, COALESCE(SUM(a.valor_cobrado), 0) AS faturamento
           FROM agendamentos a WHERE ${CONCLUIDOS_NO_PERIODO}`,
        p,
      ),
      this.atendimentosPorMes(de, ate),
      this.atendimentosPorServico(de, ate),
      this.atendimentosPorProfissional(de, ate),
      this.contagemPorStatus(de, ate),
      this.clientesNovosERecorrentes(de, ate),
    ]);

    const atendimentos = Number(totais[0]?.atendimentos ?? 0);
    const faturamento = Number(totais[0]?.faturamento ?? 0);
    const encerrados = porStatus.CONCLUIDO + porStatus.CANCELADO + porStatus.FALTOU;

    return {
      periodo,
      atendimentosConcluidos: atendimentos,
      faturamento,
      ticketMedio: atendimentos > 0 ? EstatisticasService.arredondar(faturamento / atendimentos) : 0,
      porMes,
      porServico,
      porProfissional,
      porStatus,
      taxaCancelamento: EstatisticasService.percentual(porStatus.CANCELADO, encerrados),
      taxaFalta: EstatisticasService.percentual(porStatus.FALTOU, encerrados),
      clientesNovos: clientes.novos,
      clientesRecorrentes: clientes.recorrentes,
    };
  }

  /** Atendimentos concluídos e faturamento por mês (AAAA-MM). */
  public async atendimentosPorMes(de: Date, ate: Date): Promise<ContagemValorDTO[]> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT DATE_FORMAT(a.data_hora_inicio, '%Y-%m') AS chave,
              COUNT(*) AS atendimentos, COALESCE(SUM(a.valor_cobrado), 0) AS faturamento
         FROM agendamentos a
        WHERE ${CONCLUIDOS_NO_PERIODO}
        GROUP BY chave
        ORDER BY chave`,
      [de, ate],
    );
    return rows.map((r) => {
      const [ano, mes] = String(r.chave).split('-');
      return EstatisticasService.contagem(r, `${mes}/${ano}`);
    });
  }

  /** Atendimentos concluídos e faturamento por serviço (maior faturamento primeiro). */
  public async atendimentosPorServico(de: Date, ate: Date): Promise<ContagemValorDTO[]> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT s.id AS chave, s.nome AS rotulo,
              COUNT(*) AS atendimentos, COALESCE(SUM(a.valor_cobrado), 0) AS faturamento
         FROM agendamentos a JOIN servicos s ON s.id = a.servico_id
        WHERE ${CONCLUIDOS_NO_PERIODO}
        GROUP BY s.id, s.nome
        ORDER BY faturamento DESC, atendimentos DESC`,
      [de, ate],
    );
    return rows.map((r) => EstatisticasService.contagem(r, String(r.rotulo)));
  }

  /** Atendimentos concluídos e faturamento por profissional. */
  public async atendimentosPorProfissional(de: Date, ate: Date): Promise<ContagemValorDTO[]> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT u.id AS chave, u.nome AS rotulo,
              COUNT(*) AS atendimentos, COALESCE(SUM(a.valor_cobrado), 0) AS faturamento
         FROM agendamentos a JOIN usuarios u ON u.id = a.profissional_id
        WHERE ${CONCLUIDOS_NO_PERIODO}
        GROUP BY u.id, u.nome
        ORDER BY faturamento DESC, atendimentos DESC`,
      [de, ate],
    );
    return rows.map((r) => EstatisticasService.contagem(r, String(r.rotulo)));
  }

  /** Quantidade de agendamentos (com início no período) por status. */
  public async contagemPorStatus(de: Date, ate: Date): Promise<Record<StatusAgendamentoValor, number>> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT a.status, COUNT(*) AS total
         FROM agendamentos a
        WHERE a.ativo = 1 AND a.data_hora_inicio >= ? AND a.data_hora_inicio < ?
        GROUP BY a.status`,
      [de, ate],
    );
    const resultado: Record<StatusAgendamentoValor, number> = {
      AGENDADO: 0, CONFIRMADO: 0, CONCLUIDO: 0, CANCELADO: 0, FALTOU: 0,
    };
    for (const r of rows) {
      if (r.status in resultado) resultado[r.status as StatusAgendamentoValor] = Number(r.total);
    }
    return resultado;
  }

  /**
   * Entre os clientes atendidos no período: novos = primeiro atendimento concluído
   * dentro do período; recorrentes = já tinham sido atendidos antes.
   */
  public async clientesNovosERecorrentes(de: Date, ate: Date): Promise<{ novos: number; recorrentes: number }> {
    const rows = await this.db.query<RowDataPacket>(
      `SELECT COALESCE(SUM(primeiro.primeiro_atendimento >= ?), 0) AS novos,
              COALESCE(SUM(primeiro.primeiro_atendimento < ?), 0) AS recorrentes
         FROM (
           SELECT a.cliente_id, MIN(a.data_hora_inicio) AS primeiro_atendimento
             FROM agendamentos a
            WHERE a.ativo = 1 AND a.status = 'CONCLUIDO'
            GROUP BY a.cliente_id
         ) AS primeiro
        WHERE primeiro.cliente_id IN (
           SELECT a.cliente_id FROM agendamentos a WHERE ${CONCLUIDOS_NO_PERIODO}
        )`,
      [de, de, de, ate],
    );
    return { novos: Number(rows[0]?.novos ?? 0), recorrentes: Number(rows[0]?.recorrentes ?? 0) };
  }

  /** Converte o período (datas inclusivas) em [de, ate) e valida. */
  public static intervalo(periodo: PeriodoPayload): { de: Date; ate: Date } {
    const de = DataHora.parseData(periodo?.dataInicio ?? '');
    const fim = DataHora.parseData(periodo?.dataFim ?? '');
    if (!de || !fim) throw new ValidationError('Período inválido: informe dataInicio e dataFim (AAAA-MM-DD).');
    if (de > fim) throw new ValidationError('A data inicial deve ser anterior à final.');
    const ate = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1);
    if ((ate.getTime() - de.getTime()) / 86_400_000 > MAX_DIAS_PERIODO) {
      throw new ValidationError('Período muito longo (máximo de 5 anos).');
    }
    return { de, ate };
  }

  private static contagem(r: RowDataPacket, rotulo: string): ContagemValorDTO {
    return {
      chave: String(r.chave),
      rotulo,
      atendimentos: Number(r.atendimentos),
      faturamento: EstatisticasService.arredondar(Number(r.faturamento)),
    };
  }

  private static percentual(parte: number, total: number): number {
    return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
  }

  private static arredondar(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
