import type { FiltroUsuarios, PaginaDTO, UsuarioDTO, UsuarioInput } from '../../../shared/dtos';
import { ConflictError, NotFoundError } from '../entities';
import { Usuario } from '../entities/Usuario';
import { UsuarioRepository } from '../repositories';
import { PoliticaSenha } from '../security/PoliticaSenha';
import { SenhaHasher } from './SenhaHasher';
import { gravarComUnicidade, paginaDTO } from './ServiceSupport';

const MENSAGEM_DUPLICIDADE = 'Já existe um usuário com este login, e-mail ou CPF.';

/** Gestão de usuários do sistema (uso exclusivo do ADMIN). */
export class UsuarioService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hasher: SenhaHasher,
  ) {}

  public static toDTO(u: Usuario): UsuarioDTO {
    return {
      id: u.id as number,
      nome: u.nome,
      cpf: u.cpf,
      email: u.email,
      telefone: u.telefone,
      login: u.login,
      perfil: u.perfil,
      especialidade: u.especialidade,
      ativo: u.ativo,
      ultimoAcesso: u.ultimoAcesso ? u.ultimoAcesso.toISOString() : null,
      bloqueado: u.bloqueado,
    };
  }

  public async listar(filtro: FiltroUsuarios = {}): Promise<PaginaDTO<UsuarioDTO>> {
    return paginaDTO(await this.usuarios.buscar(filtro), UsuarioService.toDTO);
  }

  public async obter(id: number): Promise<UsuarioDTO> {
    return UsuarioService.toDTO(await this.buscarOuFalhar(id));
  }

  public async criar(input: UsuarioInput): Promise<UsuarioDTO> {
    const usuario = Usuario.criar(input);
    PoliticaSenha.validar(input.senha);
    await this.garantirUnicidade(usuario);

    const senhaHash = await this.hasher.hash(input.senha as string);
    const salvo = await gravarComUnicidade(
      () => this.usuarios.create({ ...usuario.toProps(), senhaHash }),
      MENSAGEM_DUPLICIDADE,
    );
    return UsuarioService.toDTO(salvo);
  }

  /** Edita dados e perfil. `atorId` = usuário logado (para impedir que ele se rebaixe). */
  public async atualizar(id: number, input: UsuarioInput, atorId: number): Promise<UsuarioDTO> {
    const usuario = await this.buscarOuFalhar(id);
    const anterior = usuario.toProps();
    usuario.atualizar(input);
    await this.garantirUnicidade(usuario, id);

    if (anterior.perfil === 'ADMIN' && usuario.perfil !== 'ADMIN') {
      if (id === atorId) throw new ConflictError('Você não pode remover o seu próprio perfil de administrador.');
      await this.garantirOutroAdmin();
    }
    const deixouDeSerProfissional = anterior.perfil === 'PROFISSIONAL' && usuario.perfil !== 'PROFISSIONAL';
    const mudouEspecialidade = anterior.especialidade !== usuario.especialidade && usuario.perfil === 'PROFISSIONAL';
    if (deixouDeSerProfissional && (await this.usuarios.temAgendamentoFuturo(id))) {
      throw new ConflictError('Este profissional tem agendamentos futuros: remarque-os antes de mudar o perfil.');
    }
    if ((deixouDeSerProfissional || mudouEspecialidade) && (await this.usuarios.contarServicosVinculados(id)) > 0) {
      throw new ConflictError('Desvincule antes os serviços deste profissional (cadastro de profissionais).');
    }

    const salvo = await gravarComUnicidade(() => this.usuarios.update(id, usuario.toProps()), MENSAGEM_DUPLICIDADE);
    if (!salvo) throw new NotFoundError('Usuário', id);
    return UsuarioService.toDTO(salvo);
  }

  /** Exclusão lógica: o usuário não consegue mais entrar, mas o histórico fica. */
  public async inativar(id: number, atorId: number): Promise<void> {
    const usuario = await this.buscarOuFalhar(id);
    if (!usuario.ativo) return;
    if (id === atorId) throw new ConflictError('Você não pode inativar o seu próprio usuário.');
    if (usuario.perfil === 'ADMIN') await this.garantirOutroAdmin();
    if (usuario.perfil === 'PROFISSIONAL' && (await this.usuarios.temAgendamentoFuturo(id))) {
      throw new ConflictError('Este profissional tem agendamentos futuros: remarque ou cancele-os antes.');
    }
    await this.usuarios.softDelete(id);
  }

  public async reativar(id: number): Promise<void> {
    await this.buscarOuFalhar(id);
    await this.usuarios.restore(id);
  }

  /** Define uma nova senha (ex.: usuário esqueceu) e desfaz bloqueio por tentativas. */
  public async resetarSenha(id: number, novaSenha: string): Promise<void> {
    await this.buscarOuFalhar(id);
    PoliticaSenha.validar(novaSenha, 'novaSenha');
    await this.usuarios.atualizarSenha(id, await this.hasher.hash(novaSenha));
  }

  private async garantirOutroAdmin(): Promise<void> {
    if ((await this.usuarios.contarAdminsAtivos()) <= 1) {
      throw new ConflictError('O sistema precisa de pelo menos um administrador ativo.');
    }
  }

  private async garantirUnicidade(usuario: Usuario, ignorarId?: number): Promise<void> {
    const conflitos: string[] = [];
    if (await this.usuarios.existeCom('login', usuario.login, ignorarId)) conflitos.push('Login já está em uso.');
    if (await this.usuarios.existeCom('email', usuario.email, ignorarId)) conflitos.push('E-mail já está em uso.');
    if (usuario.cpf && (await this.usuarios.existeCom('cpf', usuario.cpf, ignorarId))) {
      conflitos.push('CPF já cadastrado para outro usuário.');
    }
    if (conflitos.length > 0) throw new ConflictError(conflitos.join(' '));
  }

  private async buscarOuFalhar(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findById(id);
    if (!usuario) throw new NotFoundError('Usuário', id);
    return usuario;
  }
}
