import type {
  FiltroProfissionais,
  PaginaDTO,
  ProfissionalDTO,
  ProfissionalInput,
  ServicoDTO,
} from '../../../shared/dtos';
import { SqlExecutor } from '../database/Database';
import { ConflictError, NotFoundError, Profissional, Servico, ValidationError } from '../entities';
import { ProfissionalRepository, ServicoRepository } from '../repositories';
import { SenhaHasher } from './SenhaHasher';
import { UnidadeDeTrabalho, gravarComUnicidade, paginaDTO } from './ServiceSupport';

const MENSAGEM_DUPLICIDADE = 'Já existe um usuário com este login, e-mail ou CPF.';

/** Regras de negócio do cadastro de profissionais e do vínculo N:N com serviços. */
export class ProfissionalService {
  constructor(
    private readonly profissionais: ProfissionalRepository,
    private readonly servicos: ServicoRepository,
    private readonly hasher: SenhaHasher,
    private readonly uow: UnidadeDeTrabalho,
    private readonly repositoryEmTransacao: (tx: SqlExecutor) => ProfissionalRepository = (tx) =>
      new ProfissionalRepository(tx),
  ) {}

  public async listar(filtro: FiltroProfissionais = {}): Promise<PaginaDTO<ProfissionalDTO>> {
    const page = await this.profissionais.buscar(filtro);
    return paginaDTO(page, (p) => p.toDTO());
  }

  /** Dados do profissional com os serviços que ele realiza. */
  public async obter(id: number): Promise<ProfissionalDTO> {
    const profissional = await this.buscarOuFalhar(id);
    const servicos = await this.profissionais.listarServicos(id);
    return { ...profissional.toDTO(), servicos: servicos.map((s) => s.toDTO()) };
  }

  public async criar(input: ProfissionalInput): Promise<ProfissionalDTO> {
    const profissional = Profissional.criar(input);
    Profissional.validarSenha(input.senha);
    await this.garantirUnicidade(profissional);

    const senhaHash = await this.hasher.hash(input.senha as string);
    const salvo = await gravarComUnicidade(
      () => this.profissionais.create({ ...profissional.toProps(), senhaHash }),
      MENSAGEM_DUPLICIDADE,
    );
    return { ...salvo.toDTO(), servicos: [] };
  }

  /** Edita dados cadastrais. A senha não é alterada aqui (módulo de autenticação). */
  public async atualizar(id: number, input: ProfissionalInput): Promise<ProfissionalDTO> {
    const profissional = await this.buscarOuFalhar(id);
    const especialidadeAnterior = profissional.especialidade;
    profissional.atualizar(input);
    await this.garantirUnicidade(profissional, id);

    if (profissional.especialidade !== especialidadeAnterior) {
      const incompativeis = (await this.profissionais.listarServicos(id))
        .filter((s) => !profissional.podeRealizar(s.categoria));
      if (incompativeis.length > 0) {
        throw new ConflictError(
          `Desvincule antes os serviços incompatíveis com a nova especialidade: ${incompativeis.map((s) => s.nome).join(', ')}.`,
        );
      }
    }

    const salvo = await gravarComUnicidade(
      () => this.profissionais.update(id, profissional.toProps()),
      MENSAGEM_DUPLICIDADE,
    );
    if (!salvo) throw new NotFoundError('Profissional', id);
    return this.obter(id);
  }

  /** Exclusão lógica; bloqueada se o profissional tiver agendamentos futuros em aberto. */
  public async inativar(id: number): Promise<void> {
    const profissional = await this.buscarOuFalhar(id);
    if (!profissional.ativo) return;
    if (await this.profissionais.temAgendamentoFuturo(id)) {
      throw new ConflictError(
        'Não é possível inativar: o profissional tem agendamentos futuros. Remarque ou cancele-os antes.',
      );
    }
    await this.profissionais.softDelete(id);
  }

  public async reativar(id: number): Promise<void> {
    await this.buscarOuFalhar(id);
    await this.profissionais.restore(id);
  }

  // ------------------------------------------------------------- vínculo com serviços

  public async listarServicos(profissionalId: number): Promise<ServicoDTO[]> {
    await this.buscarOuFalhar(profissionalId);
    return (await this.profissionais.listarServicos(profissionalId)).map((s) => s.toDTO());
  }

  public async vincularServico(profissionalId: number, servicoId: number): Promise<ServicoDTO[]> {
    const profissional = await this.buscarAtivoOuFalhar(profissionalId);
    const servico = await this.servicoVinculavel(profissional, servicoId);
    await this.profissionais.vincularServico(profissionalId, servico.id as number);
    return this.listarServicos(profissionalId);
  }

  public async desvincularServico(profissionalId: number, servicoId: number): Promise<ServicoDTO[]> {
    await this.buscarOuFalhar(profissionalId);
    const removido = await this.profissionais.desvincularServico(profissionalId, servicoId);
    if (!removido) throw new NotFoundError('Vínculo entre profissional e serviço');
    return this.listarServicos(profissionalId);
  }

  /** Substitui toda a lista de serviços do profissional (numa transação). */
  public async definirServicos(profissionalId: number, servicoIds: number[]): Promise<ServicoDTO[]> {
    const profissional = await this.buscarAtivoOuFalhar(profissionalId);
    const ids = [...new Set(servicoIds)];
    for (const id of ids) {
      await this.servicoVinculavel(profissional, id);
    }

    await this.uow.transaction(async (tx) => {
      const repo = this.repositoryEmTransacao(tx);
      await repo.desvincularTodos(profissionalId);
      for (const id of ids) {
        await repo.vincularServico(profissionalId, id);
      }
    });
    return this.listarServicos(profissionalId);
  }

  private async servicoVinculavel(profissional: Profissional, servicoId: number): Promise<Servico> {
    const servico = await this.servicos.findById(servicoId);
    if (!servico) throw new NotFoundError('Serviço', servicoId);
    if (!servico.ativo) throw new ConflictError(`O serviço "${servico.nome}" está inativo.`);
    if (!profissional.podeRealizar(servico.categoria)) {
      throw new ValidationError(
        `Um(a) ${profissional.especialidade.toLowerCase()} só pode ser vinculado(a) a serviços de ${profissional.categoriaAtendida.toLowerCase()}: "${servico.nome}" é de ${servico.categoria.toLowerCase()}.`,
        { servicoId: 'Serviço incompatível com a especialidade.' },
      );
    }
    return servico;
  }

  private async garantirUnicidade(profissional: Profissional, ignorarId?: number): Promise<void> {
    const conflitos: Record<string, string> = {};
    if (await this.profissionais.existeUsuarioCom('login', profissional.login, ignorarId)) {
      conflitos.login = 'Login já está em uso.';
    }
    if (await this.profissionais.existeUsuarioCom('email', profissional.email, ignorarId)) {
      conflitos.email = 'E-mail já está em uso.';
    }
    if (profissional.cpf && (await this.profissionais.existeUsuarioCom('cpf', profissional.cpf, ignorarId))) {
      conflitos.cpf = 'CPF já cadastrado para outro usuário.';
    }
    if (Object.keys(conflitos).length > 0) {
      throw new ConflictError(Object.values(conflitos).join(' '));
    }
  }

  private async buscarOuFalhar(id: number): Promise<Profissional> {
    const profissional = await this.profissionais.findById(id);
    if (!profissional) throw new NotFoundError('Profissional', id);
    return profissional;
  }

  private async buscarAtivoOuFalhar(id: number): Promise<Profissional> {
    const profissional = await this.buscarOuFalhar(id);
    if (!profissional.ativo) throw new ConflictError('Profissional está inativo.');
    return profissional;
  }
}
