import type { FiltroServicos, PaginaDTO, ServicoDTO, ServicoInput } from '../../../shared/dtos';
import { ConflictError, NotFoundError, Servico } from '../entities';
import { ServicoRepository } from '../repositories';
import { gravarComUnicidade, paginaDTO } from './ServiceSupport';

/** Regras de negócio do catálogo de serviços/procedimentos. */
export class ServicoService {
  constructor(private readonly servicos: ServicoRepository) {}

  public async listar(filtro: FiltroServicos = {}): Promise<PaginaDTO<ServicoDTO>> {
    const page = await this.servicos.buscar(filtro);
    return paginaDTO(page, (s) => s.toDTO());
  }

  public async obter(id: number): Promise<ServicoDTO> {
    return (await this.buscarOuFalhar(id)).toDTO();
  }

  public async criar(input: ServicoInput): Promise<ServicoDTO> {
    const servico = Servico.criar(input);
    await this.garantirNomeLivre(servico.nome);
    const salvo = await gravarComUnicidade(
      () => this.servicos.create(servico.toProps()),
      'Já existe um serviço com este nome.',
    );
    return salvo.toDTO();
  }

  public async atualizar(id: number, input: ServicoInput): Promise<ServicoDTO> {
    const servico = await this.buscarOuFalhar(id);
    servico.atualizar(input);
    await this.garantirNomeLivre(servico.nome, id);
    const salvo = await gravarComUnicidade(
      () => this.servicos.update(id, servico.toProps()),
      'Já existe um serviço com este nome.',
    );
    if (!salvo) throw new NotFoundError('Serviço', id);
    return salvo.toDTO();
  }

  /** Exclusão lógica; bloqueada se houver agendamento futuro em aberto com o serviço. */
  public async inativar(id: number): Promise<void> {
    const servico = await this.buscarOuFalhar(id);
    if (!servico.ativo) return;
    if (await this.servicos.temAgendamentoFuturo(id)) {
      throw new ConflictError(
        'Não é possível inativar: existem agendamentos futuros com este serviço. Cancele ou conclua-os antes.',
      );
    }
    await this.servicos.softDelete(id);
  }

  public async reativar(id: number): Promise<void> {
    await this.buscarOuFalhar(id);
    await this.servicos.restore(id);
  }

  private async garantirNomeLivre(nome: string, ignorarId?: number): Promise<void> {
    const existente = await this.servicos.findByNome(nome);
    if (existente && existente.id !== ignorarId) {
      throw new ConflictError('Já existe um serviço com este nome.');
    }
  }

  private async buscarOuFalhar(id: number): Promise<Servico> {
    const servico = await this.servicos.findById(id);
    if (!servico) throw new NotFoundError('Serviço', id);
    return servico;
  }
}
