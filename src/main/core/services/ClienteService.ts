import type {
  ClienteDTO,
  ClienteInput,
  ClienteSalvoDTO,
  ConsultaCepDTO,
  FiltroListagem,
  PaginaDTO,
} from '../../../shared/dtos';
import { ViaCepClient } from '../../integrations/ViaCepClient';
import { Cliente, ConflictError, NotFoundError } from '../entities';
import { ClienteRepository } from '../repositories';
import { gravarComUnicidade, paginaDTO } from './ServiceSupport';

/** Regras de negócio do cadastro de clientes. */
export class ClienteService {
  public static readonly AVISO_MENOR_IDADE = 'Cliente menor de 18 anos: não pode realizar tatuagem.';

  constructor(
    private readonly clientes: ClienteRepository,
    private readonly viaCep: ViaCepClient,
  ) {}

  /**
   * Endereço pelo CEP (ViaCEP). Nunca falha: sem resultado, a tela segue com
   * preenchimento manual e mostra a `mensagem`.
   */
  public async buscarEnderecoPorCep(cep: string): Promise<ConsultaCepDTO> {
    return this.viaCep.buscar(cep);
  }

  public async listar(filtro: FiltroListagem = {}): Promise<PaginaDTO<ClienteDTO>> {
    const page = await this.clientes.buscar(filtro);
    return paginaDTO(page, (c) => c.toDTO());
  }

  public async obter(id: number): Promise<ClienteDTO> {
    return (await this.buscarOuFalhar(id)).toDTO();
  }

  public async criar(input: ClienteInput): Promise<ClienteSalvoDTO> {
    const cliente = Cliente.criar(input);
    await this.garantirCpfLivre(cliente.cpf);

    const salvo = await gravarComUnicidade(
      () => this.clientes.create(cliente.toProps()),
      'Já existe um cliente com este CPF.',
    );
    return { cliente: salvo.toDTO(), avisos: this.avisos(salvo) };
  }

  public async atualizar(id: number, input: ClienteInput): Promise<ClienteSalvoDTO> {
    const cliente = await this.buscarOuFalhar(id);
    cliente.atualizar(input);
    await this.garantirCpfLivre(cliente.cpf, id);

    const salvo = await gravarComUnicidade(
      () => this.clientes.update(id, cliente.toProps()),
      'Já existe um cliente com este CPF.',
    );
    if (!salvo) throw new NotFoundError('Cliente', id);
    return { cliente: salvo.toDTO(), avisos: this.avisos(salvo) };
  }

  /** Exclusão lógica: o cliente some das listagens, mas o histórico é mantido. */
  public async inativar(id: number): Promise<void> {
    await this.buscarOuFalhar(id);
    await this.clientes.softDelete(id);
  }

  public async reativar(id: number): Promise<void> {
    await this.buscarOuFalhar(id);
    await this.clientes.restore(id);
  }

  private avisos(cliente: Cliente): string[] {
    return cliente.isMenorDeIdade() ? [ClienteService.AVISO_MENOR_IDADE] : [];
  }

  private async garantirCpfLivre(cpf: string, ignorarId?: number): Promise<void> {
    const existente = await this.clientes.findByCpf(cpf);
    if (existente && existente.id !== ignorarId) {
      const sufixo = existente.ativo ? '' : ' (cadastro inativo: reative-o em vez de criar outro)';
      throw new ConflictError(`Já existe um cliente com este CPF${sufixo}.`);
    }
  }

  private async buscarOuFalhar(id: number): Promise<Cliente> {
    const cliente = await this.clientes.findById(id);
    if (!cliente) throw new NotFoundError('Cliente', id);
    return cliente;
  }
}
