/** Formatação para exibição (pt-BR) e conversões de data no horário local. */
export class Formato {
  public static moeda(valor: number | null | undefined, moeda: 'BRL' | 'USD' = 'BRL'): string {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: moeda });
  }

  public static numero(valor: number | null | undefined, casas = 0): string {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 2) });
  }

  /** 'AAAA-MM-DD...' → 'dd/mm/aaaa' */
  public static data(iso: string | null | undefined): string {
    if (!iso) return '—';
    return iso.slice(0, 10).split('-').reverse().join('/');
  }

  /** 'AAAA-MM-DDTHH:mm...' → 'HH:mm' */
  public static hora(iso: string): string {
    return iso.slice(11, 16);
  }

  public static dataHora(iso: string | null | undefined): string {
    return iso ? `${Formato.data(iso)} às ${Formato.hora(iso)}` : '—';
  }

  public static cpf(c: string | null | undefined): string {
    const d = (c ?? '').replace(/\D/g, '');
    return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : c ?? '—';
  }

  public static telefone(t: string | null | undefined): string {
    const d = (t ?? '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    return t || '—';
  }

  public static cep(c: string | null | undefined): string {
    const d = (c ?? '').replace(/\D/g, '');
    return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, '$1-$2') : c ?? '';
  }

  /** Date → 'AAAA-MM-DD' (local). */
  public static isoData(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** 'AAAA-MM-DD' → Date local à meia-noite. */
  public static paraData(iso: string): Date {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  public static somarDias(d: Date, dias: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
  }

  /** Segunda-feira da semana de `d`. */
  public static inicioSemana(d: Date): Date {
    const dia = d.getDay() === 0 ? 7 : d.getDay();
    return Formato.somarDias(d, 1 - dia);
  }

  public static diaSemana(d: Date, curto = false): string {
    const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const n = nomes[d.getDay()];
    return curto ? n.slice(0, 3) : n;
  }

  public static iniciais(nome: string): string {
    const p = nome.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
}

export const ROTULOS_STATUS: Readonly<Record<string, string>> = {
  AGENDADO: 'Agendado', CONFIRMADO: 'Confirmado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado', FALTOU: 'Faltou',
  PENDENTE: 'Pendente', ENVIADO: 'Enviado', FALHA: 'Falha',
};

export const ROTULOS_PERFIL: Readonly<Record<string, string>> = {
  ADMIN: 'Administrador', RECEPCAO: 'Recepção', PROFISSIONAL: 'Profissional',
};

export const ROTULOS_CATEGORIA: Readonly<Record<string, string>> = { TATUAGEM: 'Tatuagem', ESTETICA: 'Estética' };
export const ROTULOS_ESPECIALIDADE: Readonly<Record<string, string>> = { TATUADOR: 'Tatuador(a)', ESTETICISTA: 'Esteticista' };
