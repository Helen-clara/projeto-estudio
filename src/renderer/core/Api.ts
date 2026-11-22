import type { ApiResult } from '../../shared/dtos';

/** Erro devolvido pelo backend (mensagem já em português e segura para exibir). */
export class ErroApi extends Error {
  constructor(message: string, public readonly sessaoExpirada = false) {
    super(message);
    this.name = 'ErroApi';
  }
}

/** Evento disparado quando qualquer chamada detecta sessão expirada. */
export const EVENTO_SESSAO_EXPIRADA = 'ink:sessao-expirada';

/**
 * Ponte única entre as telas e `window.api` (preload): desembrulha `{ ok, data, error }`,
 * transforma falhas em ErroApi e avisa o shell quando a sessão expira.
 */
export class Api {
  public static async chamar<T>(chamada: Promise<ApiResult<T>>): Promise<T> {
    let resposta: ApiResult<T>;
    try {
      resposta = await chamada;
    } catch {
      throw new ErroApi('Não foi possível falar com o aplicativo. Tente novamente.');
    }
    if (!resposta.ok) {
      const msg = resposta.error ?? 'Erro desconhecido.';
      const expirou = msg.startsWith('Sessão expirada');
      if (expirou) window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA, { detail: msg }));
      throw new ErroApi(msg, expirou);
    }
    return resposta.data as T;
  }

  /** Atalho para o objeto exposto pelo preload. */
  public static get w(): Window['api'] {
    return window.api;
  }
}
