import type {
  CategoriaValor,
  ClienteInput,
  EnderecoDTO,
  EspecialidadeValor,
  FiltroListagem,
  FiltroProfissionais,
  FiltroServicos,
  ProfissionalInput,
  ServicoInput,
} from '../../shared/dtos';
import { Profissional, Servico, ValidationError } from '../core/entities';

type Objeto = Record<string, unknown>;

/**
 * Validação de formato do que chega do renderer (dados não confiáveis).
 * Aqui só se garante tipo e tamanho; as regras de conteúdo (CPF, e-mail...)
 * ficam nas entidades. Campos desconhecidos são descartados.
 */
export class IpcEntrada {
  private static readonly TEXTO_MAXIMO = 2000;

  public static objeto(valor: unknown, nome = 'dados'): Objeto {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      throw new ValidationError(`Formato inválido: ${nome} deve ser um objeto.`);
    }
    return valor as Objeto;
  }

  public static id(valor: unknown, campo = 'id'): number {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      throw new ValidationError(`${campo} inválido.`, { [campo]: 'Informe um id inteiro positivo.' });
    }
    return valor;
  }

  public static idOpcional(valor: unknown, campo = 'id'): number | undefined {
    return valor === undefined || valor === null ? undefined : IpcEntrada.id(valor, campo);
  }

  public static ids(valor: unknown, campo: string): number[] {
    if (!Array.isArray(valor) || valor.length > 200) {
      throw new ValidationError(`${campo} deve ser uma lista de ids.`, { [campo]: 'Lista inválida.' });
    }
    return valor.map((v) => IpcEntrada.id(v, campo));
  }

  public static texto(valor: unknown, campo: string, max = IpcEntrada.TEXTO_MAXIMO): string {
    if (typeof valor !== 'string') {
      throw new ValidationError(`${campo} é obrigatório.`, { [campo]: 'Campo obrigatório.' });
    }
    if (valor.length > max) {
      throw new ValidationError(`${campo} muito longo.`, { [campo]: `Máximo de ${max} caracteres.` });
    }
    return valor;
  }

  public static textoOpcional(valor: unknown, campo: string, max = IpcEntrada.TEXTO_MAXIMO): string | null {
    return valor === undefined || valor === null || valor === '' ? null : IpcEntrada.texto(valor, campo, max);
  }

  public static numero(valor: unknown, campo: string): number {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      throw new ValidationError(`${campo} deve ser um número.`, { [campo]: 'Número inválido.' });
    }
    return valor;
  }

  // ------------------------------------------------------------- filtros

  public static filtroListagem(valor: unknown): FiltroListagem {
    if (valor === undefined || valor === null) return {};
    const o = IpcEntrada.objeto(valor, 'filtro');
    const filtro: FiltroListagem = {};
    const termo = IpcEntrada.textoOpcional(o.termo, 'termo', 120);
    if (termo) filtro.termo = termo;
    if (o.ativo !== undefined) {
      if (o.ativo !== true && o.ativo !== false && o.ativo !== 'todos') {
        throw new ValidationError('Filtro "ativo" deve ser true, false ou "todos".');
      }
      filtro.ativo = o.ativo;
    }
    if (o.limit !== undefined) filtro.limit = IpcEntrada.numero(o.limit, 'limit');
    if (o.offset !== undefined) filtro.offset = IpcEntrada.numero(o.offset, 'offset');
    return filtro;
  }

  public static filtroServicos(valor: unknown): FiltroServicos {
    const filtro: FiltroServicos = IpcEntrada.filtroListagem(valor);
    const categoria = valor ? (valor as Objeto).categoria : undefined;
    if (categoria !== undefined && categoria !== null && categoria !== '') {
      if (!Servico.isCategoria(categoria)) throw new ValidationError('Categoria inválida.');
      filtro.categoria = categoria as CategoriaValor;
    }
    return filtro;
  }

  public static filtroProfissionais(valor: unknown): FiltroProfissionais {
    const filtro: FiltroProfissionais = IpcEntrada.filtroListagem(valor);
    const especialidade = valor ? (valor as Objeto).especialidade : undefined;
    if (especialidade !== undefined && especialidade !== null && especialidade !== '') {
      if (!Profissional.isEspecialidade(especialidade)) throw new ValidationError('Especialidade inválida.');
      filtro.especialidade = especialidade as EspecialidadeValor;
    }
    return filtro;
  }

  // ------------------------------------------------------------- payloads de salvar

  /** `{ id?, dados }` → id opcional + objeto de dados. */
  public static salvar(valor: unknown): { id?: number; dados: Objeto } {
    const o = IpcEntrada.objeto(valor, 'payload');
    return { id: IpcEntrada.idOpcional(o.id), dados: IpcEntrada.objeto(o.dados) };
  }

  public static cliente(d: Objeto): ClienteInput {
    return {
      nome: IpcEntrada.texto(d.nome, 'nome', 120),
      cpf: IpcEntrada.texto(d.cpf, 'cpf', 14),
      dataNascimento: IpcEntrada.texto(d.dataNascimento, 'dataNascimento', 10),
      telefone: IpcEntrada.textoOpcional(d.telefone, 'telefone', 20),
      email: IpcEntrada.textoOpcional(d.email, 'email', 150),
      observacoes: IpcEntrada.textoOpcional(d.observacoes, 'observacoes'),
      endereco: d.endereco === undefined || d.endereco === null ? null : IpcEntrada.endereco(d.endereco),
    };
  }

  public static endereco(valor: unknown): EnderecoDTO {
    const e = IpcEntrada.objeto(valor, 'endereco');
    return {
      cep: IpcEntrada.texto(e.cep, 'endereco.cep', 9),
      logradouro: IpcEntrada.textoOpcional(e.logradouro, 'endereco.logradouro', 150),
      numero: IpcEntrada.textoOpcional(e.numero, 'endereco.numero', 10),
      complemento: IpcEntrada.textoOpcional(e.complemento, 'endereco.complemento', 80),
      bairro: IpcEntrada.textoOpcional(e.bairro, 'endereco.bairro', 80),
      cidade: IpcEntrada.textoOpcional(e.cidade, 'endereco.cidade', 80),
      uf: IpcEntrada.textoOpcional(e.uf, 'endereco.uf', 2),
    };
  }

  public static servico(d: Objeto): ServicoInput {
    if (!Servico.isCategoria(d.categoria)) {
      throw new ValidationError('Categoria deve ser TATUAGEM ou ESTETICA.', { categoria: 'Categoria inválida.' });
    }
    return {
      nome: IpcEntrada.texto(d.nome, 'nome', 120),
      descricao: IpcEntrada.textoOpcional(d.descricao, 'descricao', 500),
      categoria: d.categoria,
      duracaoMinutos: IpcEntrada.numero(d.duracaoMinutos, 'duracaoMinutos'),
      preco: IpcEntrada.numero(d.preco, 'preco'),
    };
  }

  public static profissional(d: Objeto): ProfissionalInput {
    if (!Profissional.isEspecialidade(d.especialidade)) {
      throw new ValidationError('Especialidade deve ser TATUADOR ou ESTETICISTA.', { especialidade: 'Especialidade inválida.' });
    }
    const input: ProfissionalInput = {
      nome: IpcEntrada.texto(d.nome, 'nome', 120),
      cpf: IpcEntrada.textoOpcional(d.cpf, 'cpf', 14),
      email: IpcEntrada.texto(d.email, 'email', 150),
      telefone: IpcEntrada.textoOpcional(d.telefone, 'telefone', 20),
      login: IpcEntrada.texto(d.login, 'login', 50),
      especialidade: d.especialidade,
    };
    if (d.senha !== undefined && d.senha !== null && d.senha !== '') {
      input.senha = IpcEntrada.texto(d.senha, 'senha', 72);
    }
    return input;
  }

  public static vinculo(valor: unknown): { profissionalId: number; servicoId: number } {
    const o = IpcEntrada.objeto(valor, 'payload');
    return {
      profissionalId: IpcEntrada.id(o.profissionalId, 'profissionalId'),
      servicoId: IpcEntrada.id(o.servicoId, 'servicoId'),
    };
  }
}
