import cron, { ScheduledTask } from 'node-cron';
import type { ResumoProcessamentoDTO } from '../../../shared/lembretes';

export interface ConfigAgendador {
  /** Expressão cron da execução diária (padrão: 09:00 → '0 9 * * *'). */
  cronDiario: string;
  /** Expressão cron da verificação periódica (padrão: a cada hora, no minuto 30). */
  cronPeriodico: string;
}

/**
 * Agenda o processamento de lembretes enquanto o app está aberto (node-cron):
 *  - ao iniciar o app: pega pendências atrasadas;
 *  - todo dia no horário configurado (LEMBRETE_HORARIO, padrão 09:00);
 *  - a cada hora: agendamentos criados em cima da hora e novas tentativas de falhas.
 * Execuções sobrepostas são evitadas pelo LembreteService.
 */
export class AgendadorService {
  private tarefas: ScheduledTask[] = [];

  constructor(
    private readonly processar: () => Promise<ResumoProcessamentoDTO>,
    private readonly config: ConfigAgendador = AgendadorService.configDoAmbiente(),
    private readonly log: (mensagem: string) => void = (m) => console.info(m),
  ) {
    for (const expr of [config.cronDiario, config.cronPeriodico]) {
      if (!cron.validate(expr)) throw new Error(`Expressão cron inválida: "${expr}".`);
    }
  }

  public static configDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigAgendador {
    const m = /^(\d{1,2}):(\d{2})$/.exec(env.LEMBRETE_HORARIO?.trim() ?? '');
    const valido = m && Number(m[1]) < 24 && Number(m[2]) < 60;
    return {
      cronDiario: valido ? `${Number(m[2])} ${Number(m[1])} * * *` : '0 9 * * *',
      cronPeriodico: '30 * * * *',
    };
  }

  public get ativo(): boolean {
    return this.tarefas.length > 0;
  }

  /** Inicia os agendamentos e roda uma verificação imediata (sem bloquear a abertura do app). */
  public iniciar(): void {
    if (this.ativo) return;
    this.tarefas = [
      cron.schedule(this.config.cronDiario, () => void this.executar('diário')),
      cron.schedule(this.config.cronPeriodico, () => void this.executar('periódico')),
    ];
    this.log(`[lembretes] agendador iniciado (diário: "${this.config.cronDiario}", periódico: "${this.config.cronPeriodico}")`);
    void this.executar('inicialização');
  }

  public parar(): void {
    this.tarefas.forEach((t) => t.stop());
    if (this.ativo) this.log('[lembretes] agendador parado');
    this.tarefas = [];
  }

  /** Executa uma vez; erros (ex.: banco fora do ar) são registrados sem derrubar o app. */
  public async executar(origem: string): Promise<ResumoProcessamentoDTO | null> {
    try {
      const r = await this.processar();
      if (r.emAndamento) {
        this.log(`[lembretes] ${origem}: já havia um processamento em andamento`);
      } else if (r.verificados > 0) {
        this.log(
          `[lembretes] ${origem}: ${r.verificados} verificado(s) — ${r.enviados} enviado(s), ` +
            `${r.simulados} simulado(s), ${r.falhas} falha(s), ${r.ignorados} ignorado(s)`,
        );
      }
      return r;
    } catch (error) {
      this.log(`[lembretes] ${origem}: erro ao processar — ${(error as Error)?.message ?? error}`);
      return null;
    }
  }
}
