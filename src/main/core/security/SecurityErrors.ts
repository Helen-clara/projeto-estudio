import { DomainError } from '../entities/DomainErrors';

/** Sem sessão válida (não logado ou sessão expirada). */
export class UnauthorizedError extends DomainError {
  public readonly code = 'UNAUTHORIZED';

  constructor(message = 'Sessão expirada ou não iniciada. Faça login novamente.') {
    super(message);
  }
}

/** Logado, mas o perfil não tem a permissão exigida. */
export class ForbiddenError extends DomainError {
  public readonly code = 'FORBIDDEN';

  constructor(message = 'Você não tem permissão para esta ação.') {
    super(message);
  }
}

/** Falha de autenticação (mensagem sempre genérica). */
export class AuthenticationError extends DomainError {
  public readonly code = 'AUTHENTICATION';

  constructor(message = 'Usuário ou senha inválidos.') {
    super(message);
  }
}
