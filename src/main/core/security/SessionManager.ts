import type { EspecialidadeValor, PerfilValor } from '../../../shared/dtos';

/** Dados do usuário logado guardados em memória (sem senha nem hash). */
export interface UsuarioSessao {
  readonly id: number;
  readonly nome: string;
  readonly login: string;
  readonly perfil: PerfilValor;
  readonly especialidade: EspecialidadeValor | null;
}

/**
 * Sessão do usuário logado no processo main (Singleton: o app desktop tem um
 * único usuário por vez). A sessão expira após um período sem atividade; cada
 * chamada autorizada renova o prazo (`tocar`).
 */
export class SessionManager {
  public static readonly TIMEOUT_PADRAO_MINUTOS = 30;
  private static instance: SessionManager | null = null;

  private usuario: UsuarioSessao | null = null;
  private ultimaAtividade = 0;

  /** Use `getInstance()` no app; o construtor público existe para testes. */
  constructor(
    private readonly timeoutMs: number = SessionManager.timeoutDoAmbiente(),
    private readonly agora: () => number = () => Date.now(),
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Timeout de sessão inválido.');
    }
  }

  public static getInstance(): SessionManager {
    SessionManager.instance ??= new SessionManager();
    return SessionManager.instance;
  }

  /** SESSAO_TIMEOUT_MINUTOS no .env (padrão 30). */
  private static timeoutDoAmbiente(): number {
    const minutos = Number(process.env.SESSAO_TIMEOUT_MINUTOS ?? SessionManager.TIMEOUT_PADRAO_MINUTOS);
    const valido = Number.isFinite(minutos) && minutos > 0 ? minutos : SessionManager.TIMEOUT_PADRAO_MINUTOS;
    return valido * 60_000;
  }

  public iniciar(usuario: UsuarioSessao): void {
    this.usuario = Object.freeze({ ...usuario });
    this.ultimaAtividade = this.agora();
  }

  /** Usuário logado, ou null se não houver sessão ou ela tiver expirado (nesse caso faz logout). */
  public getUsuarioAtual(): UsuarioSessao | null {
    if (this.usuario && this.agora() - this.ultimaAtividade > this.timeoutMs) {
      this.logout();
    }
    return this.usuario;
  }

  /** Renova o prazo de inatividade. Devolve false se não há sessão válida. */
  public tocar(): boolean {
    if (!this.getUsuarioAtual()) return false;
    this.ultimaAtividade = this.agora();
    return true;
  }

  public logout(): void {
    this.usuario = null;
    this.ultimaAtividade = 0;
  }

  /** Momento em que a sessão expira se não houver nova atividade. */
  public expiraEm(): Date | null {
    return this.getUsuarioAtual() ? new Date(this.ultimaAtividade + this.timeoutMs) : null;
  }
}
