import type { UsuarioSessaoDTO } from '../../shared/dtos';

/**
 * Usuário logado na tela. Serve só para decidir o que MOSTRAR: a permissão de
 * verdade é sempre checada no processo main (IpcGuard) a cada chamada.
 */
export class Sessao {
  constructor(public readonly usuario: UsuarioSessaoDTO) {}

  public pode(...permissoes: string[]): boolean {
    return permissoes.some((p) => this.usuario.permissoes.includes(p));
  }

  public get ehProfissional(): boolean {
    return this.usuario.perfil === 'PROFISSIONAL';
  }

  public get primeiroNome(): string {
    return this.usuario.nome.trim().split(/\s+/)[0] ?? this.usuario.nome;
  }
}
