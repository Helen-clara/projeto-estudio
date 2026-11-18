import bcrypt from 'bcryptjs';

/** Gera hash de senha (abstração para permitir trocar o algoritmo ou simular em testes). */
export interface SenhaHasher {
  hash(senha: string): Promise<string>;
}

/** Hash com bcryptjs (salt aleatório embutido no hash). */
export class BcryptSenhaHasher implements SenhaHasher {
  constructor(private readonly custo: number = 10) {}

  public hash(senha: string): Promise<string> {
    return bcrypt.hash(senha, this.custo);
  }
}
