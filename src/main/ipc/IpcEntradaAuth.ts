import type { FiltroUsuarios, LoginPayload, PerfilValor, TrocarSenhaPayload, UsuarioInput } from '../../shared/dtos';
import { Profissional, ValidationError } from '../core/entities';
import { Usuario } from '../core/entities/Usuario';
import { IpcEntrada } from './IpcEntrada';

type Objeto = Record<string, unknown>;

/** Validação de formato dos payloads de autenticação e de usuários. */
export class IpcEntradaAuth {
  /** Login: tipos errados viram credencial vazia (o AuthService responde com a mensagem genérica). */
  public static login(valor: unknown): LoginPayload {
    const o = typeof valor === 'object' && valor !== null ? (valor as Objeto) : {};
    return {
      login: typeof o.login === 'string' ? o.login.slice(0, 100) : '',
      senha: typeof o.senha === 'string' ? o.senha.slice(0, 200) : '',
    };
  }

  public static trocarSenha(valor: unknown): TrocarSenhaPayload {
    const o = IpcEntrada.objeto(valor, 'payload');
    return {
      senhaAtual: IpcEntrada.texto(o.senhaAtual, 'senhaAtual', 200),
      novaSenha: IpcEntrada.texto(o.novaSenha, 'novaSenha', 200),
    };
  }

  public static resetarSenha(valor: unknown): { id: number; novaSenha: string } {
    const o = IpcEntrada.objeto(valor, 'payload');
    return { id: IpcEntrada.id(o.id), novaSenha: IpcEntrada.texto(o.novaSenha, 'novaSenha', 200) };
  }

  public static filtroUsuarios(valor: unknown): FiltroUsuarios {
    const filtro: FiltroUsuarios = IpcEntrada.filtroListagem(valor);
    const perfil = valor ? (valor as Objeto).perfil : undefined;
    if (perfil !== undefined && perfil !== null && perfil !== '') {
      if (!Usuario.isPerfil(perfil)) throw new ValidationError('Perfil inválido.');
      filtro.perfil = perfil as PerfilValor;
    }
    return filtro;
  }

  public static usuario(d: Objeto): UsuarioInput {
    if (!Usuario.isPerfil(d.perfil)) {
      throw new ValidationError('Perfil deve ser ADMIN, RECEPCAO ou PROFISSIONAL.', { perfil: 'Perfil inválido.' });
    }
    const especialidade = d.especialidade === undefined || d.especialidade === null || d.especialidade === ''
      ? null
      : d.especialidade;
    if (especialidade !== null && !Profissional.isEspecialidade(especialidade)) {
      throw new ValidationError('Especialidade inválida.', { especialidade: 'Use TATUADOR ou ESTETICISTA.' });
    }
    const input: UsuarioInput = {
      nome: IpcEntrada.texto(d.nome, 'nome', 120),
      cpf: IpcEntrada.textoOpcional(d.cpf, 'cpf', 14),
      email: IpcEntrada.texto(d.email, 'email', 150),
      telefone: IpcEntrada.textoOpcional(d.telefone, 'telefone', 20),
      login: IpcEntrada.texto(d.login, 'login', 50),
      perfil: d.perfil,
      especialidade,
    };
    if (d.senha !== undefined && d.senha !== null && d.senha !== '') {
      input.senha = IpcEntrada.texto(d.senha, 'senha', 200);
    }
    return input;
  }
}
