import { Sessao } from '../core/Sessao.js';

/** Tela do sistema. Cada tela monta seu conteúdo dentro do `alvo` dado pelo shell. */
export abstract class View {
  constructor(protected readonly sessao: Sessao) {}

  /** Monta a tela. Erros lançados aqui aparecem como alerta na área de conteúdo. */
  public abstract render(alvo: HTMLElement): Promise<void>;

  /** Ação do atalho Ctrl+N (ex.: "novo cliente"). Opcional. */
  public novo?(): void;
}

/** Item de navegação: como a tela aparece no menu e quem pode vê-la. */
export interface RotaView {
  id: string;
  rotulo: string;
  icone: string;
  grupo: 'Atendimento' | 'Cadastros' | 'Gestão';
  /** Frase curta exibida no topo explicando para que serve a tela. */
  descricao: string;
  /** Visível somente com pelo menos uma destas permissões (vazio = todos). */
  permissoes: string[];
  criar: (sessao: Sessao) => View;
}
