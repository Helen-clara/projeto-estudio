import { h } from '../core/dom.js';

export type TipoCampo = 'texto' | 'email' | 'senha' | 'numero' | 'data' | 'hora' | 'select' | 'textarea' | 'checkbox';
export type Mascara = 'cpf' | 'telefone' | 'cep';

export interface OpcoesCampo {
  rotulo: string;
  tipo?: TipoCampo;
  valor?: string | number | boolean | null;
  obrigatorio?: boolean;
  /** Para select: [valor, texto]. */
  opcoes?: Array<[string, string]>;
  mascara?: Mascara;
  ajuda?: string;
  /** Colunas ocupadas numa grade de 6. */
  largura?: 1 | 2 | 3 | 4 | 6;
  min?: number | string;
  max?: number | string;
  passo?: number | string;
  maxLength?: number;
  placeholder?: string;
  desabilitado?: boolean;
  autocomplete?: string;
  /** Validação extra: devolve a mensagem de erro ou null. */
  validar?: (valor: string) => string | null;
}

let sequencia = 0;

/**
 * Campo de formulário com rótulo, máscara (CPF/telefone/CEP), validação no cliente
 * e mensagem de erro ligada por aria-describedby. A validação no cliente é só para
 * ajudar quem digita: o main valida tudo de novo.
 */
export class FormField {
  public readonly elemento: HTMLElement;
  public readonly entrada: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  private readonly mensagem: HTMLElement;
  private readonly ajuda: HTMLElement;

  constructor(private readonly opcoes: OpcoesCampo) {
    const id = `campo-${++sequencia}`;
    const tipo = opcoes.tipo ?? 'texto';
    this.entrada = FormField.criarEntrada(id, tipo, opcoes);
    this.mensagem = h('span', { id: `${id}-erro`, class: 'campo__erro', hidden: true });
    this.ajuda = h('span', { id: `${id}-ajuda`, class: 'campo__ajuda', hidden: !opcoes.ajuda }, opcoes.ajuda ?? '');
    this.entrada.setAttribute('aria-describedby', `${id}-ajuda ${id}-erro`);

    if (tipo === 'checkbox') {
      this.elemento = h('label', { class: `campo campo--check campo--${opcoes.largura ?? 3}` }, this.entrada, h('span', {}, opcoes.rotulo));
    } else {
      this.elemento = h('div', { class: `campo campo--${opcoes.largura ?? 3}` },
        h('label', { class: 'campo__rotulo', for: id }, opcoes.rotulo, opcoes.obrigatorio ? h('span', { class: 'obrigatorio', 'aria-hidden': 'true' }, '*') : null),
        this.entrada, this.ajuda, this.mensagem);
    }

    if (opcoes.mascara) {
      this.entrada.addEventListener('input', () => {
        const ent = this.entrada as HTMLInputElement;
        ent.value = FormField.aplicarMascara(opcoes.mascara as Mascara, ent.value);
      });
    }
    this.entrada.addEventListener('input', () => this.definirErro(null));
    if (opcoes.valor !== undefined && opcoes.valor !== null) this.definirValor(opcoes.valor);
  }

  public get valor(): string {
    return this.entrada.value.trim();
  }

  /** Valor ou null quando vazio (para campos opcionais). */
  public get valorOuNulo(): string | null {
    return this.valor === '' ? null : this.valor;
  }

  public get numero(): number {
    return this.valor === '' ? NaN : Number(this.valor.replace(',', '.'));
  }

  public get marcado(): boolean {
    return (this.entrada as HTMLInputElement).checked;
  }

  public definirValor(valor: string | number | boolean | null): void {
    if (this.opcoes.tipo === 'checkbox') {
      (this.entrada as HTMLInputElement).checked = valor === true;
      return;
    }
    const texto = valor === null ? '' : String(valor);
    this.entrada.value = this.opcoes.mascara ? FormField.aplicarMascara(this.opcoes.mascara, texto) : texto;
  }

  public definirOpcoes(opcoes: Array<[string, string]>, valor?: string): void {
    const sel = this.entrada as HTMLSelectElement;
    sel.replaceChildren(...opcoes.map(([v, t]) => h('option', { value: v }, t)));
    if (valor !== undefined) sel.value = valor;
  }

  public definirAjuda(texto: string | null, tipo: 'normal' | 'ok' | 'aviso' = 'normal'): void {
    this.ajuda.hidden = !texto;
    this.ajuda.textContent = texto ?? '';
    this.ajuda.style.color = tipo === 'ok' ? 'var(--ok)' : tipo === 'aviso' ? 'var(--aviso)' : '';
  }

  public definirErro(mensagem: string | null): void {
    this.mensagem.hidden = !mensagem;
    this.mensagem.textContent = mensagem ?? '';
    this.elemento.classList.toggle('campo--invalido', !!mensagem);
    this.entrada.setAttribute('aria-invalid', String(!!mensagem));
  }

  public desabilitar(sim: boolean): void {
    this.entrada.disabled = sim;
  }

  public focar(): void {
    this.entrada.focus();
  }

  public aoMudar(fn: () => void): void {
    this.entrada.addEventListener('change', fn);
  }

  public aoDigitar(fn: () => void): void {
    this.entrada.addEventListener('input', fn);
  }

  /** Valida e mostra o erro. */
  public validar(): boolean {
    const erro = this.erroDeValidacao();
    this.definirErro(erro);
    return erro === null;
  }

  private erroDeValidacao(): string | null {
    const o = this.opcoes;
    if (o.tipo === 'checkbox') return null;
    const v = this.valor;
    if (!v) return o.obrigatorio ? 'Campo obrigatório.' : null;
    if (o.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'E-mail inválido.';
    if (o.tipo === 'numero') {
      const n = this.numero;
      if (!Number.isFinite(n)) return 'Informe um número.';
      if (o.min !== undefined && n < Number(o.min)) return `Mínimo: ${o.min}.`;
      if (o.max !== undefined && n > Number(o.max)) return `Máximo: ${o.max}.`;
    }
    if (o.mascara === 'cpf' && !FormField.cpfValido(v)) return 'CPF inválido.';
    if (o.mascara === 'telefone' && !/^\d{10,11}$/.test(v.replace(/\D/g, ''))) return 'Telefone com DDD (10 ou 11 dígitos).';
    if (o.mascara === 'cep' && !/^\d{8}$/.test(v.replace(/\D/g, ''))) return 'CEP deve ter 8 dígitos.';
    return o.validar?.(v) ?? null;
  }

  public static aplicarMascara(mascara: Mascara, valor: string): string {
    const d = valor.replace(/\D/g, '');
    switch (mascara) {
      case 'cpf':
        return d.slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
      case 'cep':
        return d.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
      case 'telefone': {
        const t = d.slice(0, 11);
        if (t.length <= 2) return t.length ? `(${t}` : '';
        if (t.length <= 6) return `(${t.slice(0, 2)}) ${t.slice(2)}`;
        if (t.length <= 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
        return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
      }
    }
  }

  public static cpfValido(cpf: string): boolean {
    const d = cpf.replace(/\D/g, '');
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    const n = d.split('').map(Number);
    for (const t of [9, 10]) {
      const r = (n.slice(0, t).reduce((acc, x, i) => acc + x * (t + 1 - i), 0) * 10) % 11;
      if ((r === 10 ? 0 : r) !== n[t]) return false;
    }
    return true;
  }

  private static criarEntrada(id: string, tipo: TipoCampo, o: OpcoesCampo): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
    const comum = { id, name: id, class: 'campo__entrada', required: o.obrigatorio, disabled: o.desabilitado, placeholder: o.placeholder, autocomplete: o.autocomplete };
    if (tipo === 'select') {
      return h('select', comum, ...(o.opcoes ?? []).map(([v, t]) => h('option', { value: v }, t)));
    }
    if (tipo === 'textarea') return h('textarea', { ...comum, maxlength: o.maxLength });
    const tipos: Record<string, string> = { texto: 'text', email: 'email', senha: 'password', numero: 'number', data: 'date', hora: 'time', checkbox: 'checkbox' };
    return h('input', {
      ...comum,
      class: tipo === 'checkbox' ? '' : 'campo__entrada',
      type: tipos[tipo] ?? 'text',
      inputmode: o.mascara ? 'numeric' : undefined,
      maxlength: o.maxLength ?? (o.mascara === 'cpf' ? 14 : o.mascara === 'telefone' ? 15 : o.mascara === 'cep' ? 9 : undefined),
      min: o.min, max: o.max, step: o.passo,
    });
  }
}

/** Agrupa campos numa grade e valida todos de uma vez. */
export class Formulario<C extends Record<string, FormField>> {
  public readonly elemento: HTMLElement;

  constructor(public readonly campos: C, ...extras: HTMLElement[]) {
    this.elemento = h('div', { class: 'form' }, ...Object.values(campos).map((c) => c.elemento), ...extras);
  }

  /** Valida todos os campos; foca o primeiro inválido. */
  public validar(): boolean {
    let primeiro: FormField | null = null;
    for (const c of Object.values(this.campos)) {
      if (!c.validar() && !primeiro) primeiro = c;
    }
    primeiro?.focar();
    return primeiro === null;
  }
}
