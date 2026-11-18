import nodemailer, { Transporter } from 'nodemailer';
import type { CategoriaValor } from '../../../shared/dtos';
import type { PrevisaoClima } from '../../integrations/ClimaClient';
import { DataHora } from '../entities/Agendamento';

/** Configuração SMTP lida do .env. */
export interface SmtpConfig {
  host: string;
  port: number;
  /** TLS direto (porta 465). Nas outras portas usa STARTTLS quando o servidor oferece. */
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface ResultadoEnvio {
  /** true = SMTP não configurado; nada saiu do computador. */
  simulado: boolean;
  idMensagem?: string;
}

/** Contrato de envio (permite trocar por um falso nos testes). */
export interface EnviadorEmail {
  readonly modoSimulacao: boolean;
  enviar(para: string, assunto: string, html: string, texto?: string): Promise<ResultadoEnvio>;
}

/**
 * Envio de e-mail com Nodemailer, usando SMTP do .env (SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASS, SMTP_FROM). Sem SMTP completo, entra em **modo simulação**: a mensagem é só
 * registrada no log (sem conteúdo pessoal) e o envio conta como sucesso simulado.
 * Credenciais nunca aparecem em logs nem em mensagens de erro.
 */
export class NotificacaoEmailService implements EnviadorEmail {
  private readonly transporter: Transporter | null;

  constructor(
    private readonly config: SmtpConfig | null = NotificacaoEmailService.configDoAmbiente(),
    private readonly log: (mensagem: string) => void = (m) => console.info(m),
  ) {
    this.transporter = config
      ? nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.pass },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        })
      : null;
  }

  /** null quando faltar host, usuário, senha ou remetente (→ modo simulação). */
  public static configDoAmbiente(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
    const host = env.SMTP_HOST?.trim();
    const user = env.SMTP_USER?.trim();
    const pass = env.SMTP_PASS ?? '';
    const from = env.SMTP_FROM?.trim();
    if (!host || !user || !pass || !from) return null;
    const port = Number(env.SMTP_PORT ?? 587);
    const portaValida = Number.isInteger(port) && port > 0 && port < 65536 ? port : 587;
    return { host, port: portaValida, secure: portaValida === 465, user, pass, from };
  }

  public get modoSimulacao(): boolean {
    return this.transporter === null;
  }

  public async enviar(para: string, assunto: string, html: string, texto?: string): Promise<ResultadoEnvio> {
    if (!this.transporter || !this.config) {
      this.log(`[email] modo simulação: lembrete para ${NotificacaoEmailService.mascarar(para)} — "${assunto}"`);
      return { simulado: true };
    }
    try {
      const info = await this.transporter.sendMail({ from: this.config.from, to: para, subject: assunto, html, text: texto });
      this.log(`[email] enviado para ${NotificacaoEmailService.mascarar(para)}`);
      return { simulado: false, idMensagem: String(info.messageId ?? '') };
    } catch (error) {
      // Mensagem sem credenciais: só o código/tipo do erro do servidor.
      const e = error as { code?: string; responseCode?: number };
      throw new Error(`Falha no envio SMTP${e.code ? ` (${e.code})` : ''}${e.responseCode ? ` [${e.responseCode}]` : ''}.`);
    }
  }

  /** a***@dominio.com — para logs sem expor o e-mail completo (LGPD). */
  public static mascarar(email: string): string {
    const [usuario, dominio] = email.split('@');
    return dominio ? `${usuario.slice(0, 1)}***@${dominio}` : '***';
  }
}

// ------------------------------------------------------------------ template

export interface DadosMensagemLembrete {
  clienteNome: string;
  inicio: Date;
  fim: Date;
  profissionalNome: string;
  servicoNome: string;
  servicoCategoria: CategoriaValor;
  studioNome: string;
  studioEndereco: string;
  previsao: PrevisaoClima | null;
}

export interface MensagemEmail {
  assunto: string;
  html: string;
  texto: string;
}

const PREPARO: Readonly<Record<CategoriaValor, readonly string[]>> = {
  TATUAGEM: [
    'Venha alimentado(a) e bem hidratado(a).',
    'Evite bebida alcoólica nas 24 horas anteriores.',
    'Não tome sol na região a ser tatuada nos dias anteriores.',
    'Use roupa confortável que deixe a região de fácil acesso.',
    'Traga um documento com foto.',
  ],
  ESTETICA: [
    'Venha sem maquiagem ou com a pele limpa.',
    'Evite ácidos, esfoliantes e retinoides nas 48 horas anteriores.',
    'Informe a profissional sobre alergias ou medicamentos em uso.',
    'Evite exposição solar intensa antes do procedimento.',
  ],
};

/** Monta o e-mail de lembrete (HTML + texto puro) em português. */
export class MensagemLembrete {
  public static montar(d: DadosMensagemLembrete): MensagemEmail {
    const quando = DataHora.legivel(d.inicio);
    const primeiroNome = d.clienteNome.trim().split(/\s+/)[0] ?? d.clienteNome;
    const dicas = MensagemLembrete.dicasClima(d.previsao, d.servicoCategoria);
    const preparo = PREPARO[d.servicoCategoria] ?? [];
    const e = MensagemLembrete.escapar;

    const assunto = `Lembrete: ${d.servicoNome} amanhã, ${quando} — ${d.studioNome}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f4f6;font-family:Segoe UI,Arial,sans-serif;color:#202024">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e1e1e6">
    <div style="background:#121214;color:#ffffff;padding:20px 24px">
      <div style="font-size:20px;font-weight:600">${e(d.studioNome)}</div>
      <div style="font-size:13px;color:#c4b5fd">Lembrete do seu atendimento</div>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px">Olá, <strong>${e(primeiroNome)}</strong>! Seu horário está marcado para amanhã:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr><td style="padding:6px 0;color:#737380;width:130px">Data e hora</td><td style="padding:6px 0"><strong>${e(quando)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#737380">Procedimento</td><td style="padding:6px 0">${e(d.servicoNome)}</td></tr>
        <tr><td style="padding:6px 0;color:#737380">Profissional</td><td style="padding:6px 0">${e(d.profissionalNome)}</td></tr>
        <tr><td style="padding:6px 0;color:#737380">Endereço</td><td style="padding:6px 0">${e(d.studioEndereco)}</td></tr>
      </table>
      <h3 style="font-size:15px;margin:0 0 8px">Como se preparar</h3>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.6">
        ${preparo.map((p) => `<li>${e(p)}</li>`).join('\n        ')}
      </ul>
      ${dicas.length > 0 ? `<h3 style="font-size:15px;margin:0 0 8px">Previsão do tempo para amanhã</h3>
      <div style="background:#f5f0ff;border-left:4px solid #996dff;padding:12px 14px;font-size:14px;line-height:1.6;margin-bottom:20px">
        ${dicas.map((t) => `<div>${e(t)}</div>`).join('\n        ')}
      </div>` : ''}
      <p style="margin:0;font-size:13px;color:#737380">Precisa remarcar ou cancelar? Responda este e-mail ou fale com a recepção com antecedência.</p>
    </div>
  </div>
</body></html>`;

    const texto = [
      `Olá, ${primeiroNome}! Lembrete do seu atendimento no ${d.studioNome}:`,
      '',
      `Data e hora: ${quando}`,
      `Procedimento: ${d.servicoNome}`,
      `Profissional: ${d.profissionalNome}`,
      `Endereço: ${d.studioEndereco}`,
      '',
      'Como se preparar:',
      ...preparo.map((p) => `- ${p}`),
      ...(dicas.length > 0 ? ['', 'Previsão do tempo para amanhã:', ...dicas.map((t) => `- ${t}`)] : []),
      '',
      'Precisa remarcar ou cancelar? Fale com a recepção com antecedência.',
    ].join('\n');

    return { assunto, html, texto };
  }

  /** Resumo do tempo + dicas de cuidado conforme a previsão e o tipo de procedimento. */
  public static dicasClima(p: PrevisaoClima | null, categoria: CategoriaValor): string[] {
    if (!p) return [];
    const dicas: string[] = [];
    const max = p.temperaturaMax !== null ? `${Math.round(p.temperaturaMax)}°C` : null;
    const min = p.temperaturaMin !== null ? `${Math.round(p.temperaturaMin)}°C` : null;
    if (max || min) dicas.push(`Temperatura: ${[min && `mín. ${min}`, max && `máx. ${max}`].filter(Boolean).join(' / ')}.`);

    if (p.indiceUV !== null && p.indiceUV >= 6) {
      dicas.push(
        categoria === 'TATUAGEM'
          ? `Índice UV ${p.indiceUV >= 8 ? 'muito alto' : 'alto'} (${Math.round(p.indiceUV)}): evite sol após o procedimento e mantenha a tatuagem coberta.`
          : `Índice UV ${p.indiceUV >= 8 ? 'muito alto' : 'alto'} (${Math.round(p.indiceUV)}): evite sol após o procedimento e use protetor solar.`,
      );
    }
    if (p.chanceChuva !== null && p.chanceChuva >= 50) {
      dicas.push(`Chance de chuva de ${Math.round(p.chanceChuva)}%: leve guarda-chuva e saia com antecedência.`);
    }
    // Compara com o valor arredondado, igual ao que aparece na mensagem.
    if (p.temperaturaMax !== null && Math.round(p.temperaturaMax) >= 30) {
      dicas.push('Dia quente: beba bastante água antes e depois do atendimento.');
    }
    if (p.temperaturaMin !== null && Math.round(p.temperaturaMin) <= 12) {
      dicas.push('Dia frio: traga um agasalho.');
    }
    return dicas;
  }

  private static escapar(texto: string): string {
    return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  }
}
