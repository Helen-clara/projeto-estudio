import type {
  FiltroLembretes,
  LembreteDTO,
  PaginaLembretesDTO,
  ResultadoLembreteDTO,
  ResumoProcessamentoDTO,
} from '../../../shared/lembretes';
import { ClimaClient } from '../../integrations/ClimaClient';
import { ConflictError, NotFoundError, ValidationError } from '../entities';
import { DataHora } from '../entities/Agendamento';
import { Lembrete } from '../entities/Lembrete';
import { AgendamentoParaLembrete, LembreteDetalhado, LembreteRepository } from '../repositories/LembreteRepository';
import { EmailValidator } from '../validators';
import { EnviadorEmail, MensagemLembrete } from './NotificacaoEmailService';
import { paginaDTO } from './ServiceSupport';

export interface ConfigLembretes {
  /** Tentativas automáticas por lembrete (padrão 3). */
  maxTentativas: number;
  /** Horário (minutos desde 00:00) do dia anterior em que o lembrete "deveria" sair. */
  minutosEnvio: number;
  studioNome: string;
  studioEndereco: string;
}

/** Envio dos lembretes por e-mail um dia antes do agendamento, com registro de cada tentativa. */
export class LembreteService {
  private processando = false;

  constructor(
    private readonly lembretes: LembreteRepository,
    private readonly email: EnviadorEmail,
    private readonly clima: ClimaClient,
    private readonly config: ConfigLembretes = LembreteService.configDoAmbiente(),
    private readonly relogio: () => Date = () => new Date(),
  ) {}

  /** LEMBRETE_MAX_TENTATIVAS, LEMBRETE_HORARIO (HH:mm), STUDIO_NOME, STUDIO_ENDERECO. */
  public static configDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigLembretes {
    const max = Number(env.LEMBRETE_MAX_TENTATIVAS ?? 3);
    const hora = /^(\d{1,2}):(\d{2})$/.exec(env.LEMBRETE_HORARIO?.trim() ?? '');
    const minutos = hora && Number(hora[1]) < 24 && Number(hora[2]) < 60 ? Number(hora[1]) * 60 + Number(hora[2]) : 9 * 60;
    return {
      maxTentativas: Number.isInteger(max) && max >= 1 && max <= 10 ? max : 3,
      minutosEnvio: minutos,
      studioNome: env.STUDIO_NOME?.trim() || 'Ink & Glow Studio',
      studioEndereco: env.STUDIO_ENDERECO?.trim() || 'Consulte o endereço com a recepção',
    };
  }

  public static toDTO(d: LembreteDetalhado): LembreteDTO {
    const l = d.lembrete;
    return {
      id: l.id as number,
      agendamentoId: l.agendamentoId,
      canal: l.canal,
      destinatario: l.destinatario,
      status: l.status,
      simulado: l.simulado,
      tentativas: l.tentativas,
      agendadoPara: DataHora.formatar(l.agendadoPara),
      enviadoEm: l.enviadoEm ? DataHora.formatar(l.enviadoEm) : null,
      erro: l.erro,
      ativo: l.ativo,
      clienteNome: d.clienteNome,
      profissionalNome: d.profissionalNome,
      servicoNome: d.servicoNome,
      inicioAgendamento: DataHora.formatar(d.inicioAgendamento),
    };
  }

  /**
   * Envia os lembretes dos agendamentos AGENDADO/CONFIRMADO de amanhã que ainda não
   * receberam lembrete. Também pega pendências atrasadas: agendamentos de hoje que
   * ainda não começaram e ficaram sem lembrete (ex.: app fechado ontem).
   * Falhas são tentadas de novo nas próximas execuções, até `maxTentativas`.
   */
  public async processarLembretesDoDiaSeguinte(): Promise<ResumoProcessamentoDTO> {
    const agora = this.relogio();
    const resumo: ResumoProcessamentoDTO = {
      executadoEm: DataHora.formatar(agora),
      verificados: 0, enviados: 0, simulados: 0, falhas: 0, ignorados: 0,
      emAndamento: false, detalhes: [],
    };
    if (this.processando) return { ...resumo, emAndamento: true };

    this.processando = true;
    try {
      const fimDeAmanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 2);
      const candidatos = await this.lembretes.agendamentosParaLembrete(agora, fimDeAmanha, this.config.maxTentativas);
      for (const c of candidatos) {
        const r = await this.processarUm(c);
        resumo.verificados++;
        resumo.detalhes.push(r);
        if (r.resultado === 'ENVIADO') resumo.enviados++;
        else if (r.resultado === 'ENVIADO_SIMULADO') resumo.simulados++;
        else if (r.resultado === 'FALHA') resumo.falhas++;
        else resumo.ignorados++;
      }
      return resumo;
    } finally {
      this.processando = false;
    }
  }

  /** Reenvio manual (recepção): zera as tentativas e envia agora. */
  public async reenviar(lembreteId: number): Promise<ResultadoLembreteDTO> {
    const atual = await this.lembretes.findById(lembreteId);
    if (!atual || !atual.ativo) throw new NotFoundError('Lembrete', lembreteId);
    if (!(await this.lembretes.agendamentoEmAberto(atual.agendamentoId))) {
      throw new ConflictError('O agendamento já passou, foi cancelado ou concluído: não há lembrete a enviar.');
    }
    atual.reabrir();
    await this.lembretes.update(lembreteId, atual.toProps());

    const dados = await this.lembretes.agendamentoParaLembrete(atual.agendamentoId);
    if (!dados) throw new NotFoundError('Agendamento', atual.agendamentoId);
    return this.processarUm(dados);
  }

  public async listar(filtro: FiltroLembretes = {}): Promise<PaginaLembretesDTO> {
    const de = filtro.dataInicio ? DataHora.parseData(filtro.dataInicio) : null;
    const fim = filtro.dataFim ? DataHora.parseData(filtro.dataFim) : null;
    if ((filtro.dataInicio && !de) || (filtro.dataFim && !fim)) throw new ValidationError('Datas inválidas (use AAAA-MM-DD).');
    const page = await this.lembretes.buscar({
      status: filtro.status,
      agendamentoId: filtro.agendamentoId,
      de: de ?? undefined,
      ate: fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1) : undefined,
      ativo: filtro.ativo,
      limit: filtro.limit,
      offset: filtro.offset,
    });
    return paginaDTO(page, LembreteService.toDTO);
  }

  /** Exclusão lógica: o lembrete deixa de ser enviado automaticamente. */
  public async excluir(lembreteId: number): Promise<void> {
    if (!(await this.lembretes.exists(lembreteId))) throw new NotFoundError('Lembrete', lembreteId);
    await this.lembretes.softDelete(lembreteId);
  }

  /** Garante o lembrete do agendamento, tenta enviar e grava o resultado. */
  private async processarUm(c: AgendamentoParaLembrete): Promise<ResultadoLembreteDTO> {
    const lembrete = c.lembrete ?? await this.lembretes.criarPendente(
      Lembrete.criarPendente(c.agendamentoId, this.agendadoPara(c.inicio), c.clienteEmail),
    );
    const base = { agendamentoId: c.agendamentoId, lembreteId: lembrete.id };
    if (!lembrete.podeTentar(this.config.maxTentativas)) {
      return { ...base, resultado: 'IGNORADO', motivo: 'Lembrete já enviado, excluído ou sem tentativas restantes.' };
    }

    const email = c.clienteEmail?.trim() ?? '';
    if (!email || !EmailValidator.isValid(email)) {
      const motivo = email ? 'E-mail do cliente inválido.' : 'Cliente sem e-mail cadastrado.';
      lembrete.registrarFalha(motivo, email || null, true, this.config.maxTentativas);
      await this.salvar(lembrete);
      return { ...base, resultado: 'IGNORADO', motivo };
    }

    const previsao = await this.clima.previsao(c.inicio);
    const mensagem = MensagemLembrete.montar({
      clienteNome: c.clienteNome,
      inicio: c.inicio,
      fim: c.fim,
      profissionalNome: c.profissionalNome,
      servicoNome: c.servicoNome,
      servicoCategoria: c.servicoCategoria,
      studioNome: this.config.studioNome,
      studioEndereco: this.config.studioEndereco,
      previsao,
    });

    try {
      const envio = await this.email.enviar(email, mensagem.assunto, mensagem.html, mensagem.texto);
      lembrete.registrarEnvio(this.relogio(), email, envio.simulado);
      await this.salvar(lembrete);
      return { ...base, resultado: envio.simulado ? 'ENVIADO_SIMULADO' : 'ENVIADO' };
    } catch (error) {
      const motivo = (error as Error)?.message || 'Falha desconhecida no envio.';
      lembrete.registrarFalha(motivo, email, false, this.config.maxTentativas);
      await this.salvar(lembrete);
      const restantes = this.config.maxTentativas - lembrete.tentativas;
      return { ...base, resultado: 'FALHA', motivo: `${motivo} ${restantes > 0 ? `Nova tentativa na próxima execução (${restantes} restante(s)).` : 'Tentativas esgotadas.'}` };
    }
  }

  private async salvar(l: Lembrete): Promise<void> {
    await this.lembretes.update(l.id as number, l.toProps());
  }

  /** Dia anterior ao agendamento, no horário de envio configurado (padrão 09:00). */
  private agendadoPara(inicio: Date): Date {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - 1);
    d.setMinutes(this.config.minutosEnvio);
    return d;
  }
}
