import type { Plataforma, Produto, StatusProduto } from '../types/produto';
import { normalizarValidoAte, PRODUTO_LIMITES } from './produtoValidation';

export interface ProdutoFormState {
  linkOriginal: string;
  plataforma: Plataforma;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  precoAtual: string;
  precoOriginal: string;
  linkAfiliado: string;
  status: StatusProduto;
  destaque: boolean;
  validoAte: string;
  cupom: string;
}

export type ProdutoFormErros = Partial<Record<keyof ProdutoFormState, string>>;

export function isEmailAdm(
  email: string | null | undefined,
  adminList: readonly string[]
): boolean {
  if (!email) return false;
  const normalizado = email.trim().toLowerCase();
  return adminList.some((adm) => adm.trim().toLowerCase() === normalizado);
}

export function isHttpsUrl(valor: string): boolean {
  const limpo = valor.trim();
  if (!limpo || limpo.length > PRODUTO_LIMITES.URL_MAX) return false;
  try {
    const parsed = new URL(limpo);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export function isValidWebUrl(valor: string): boolean {
  const limpo = valor.trim();
  if (!limpo || limpo.length > PRODUTO_LIMITES.URL_MAX) return false;
  try {
    const parsed = new URL(limpo);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      Boolean(parsed.hostname) &&
      parsed.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

export function parsePrecoInput(valor: string): number {
  const limpo = valor.trim().replace(/\s+/g, '').replace(',', '.');
  if (!limpo) return Number.NaN;
  return Number(limpo);
}

export function validarFormularioProduto(form: ProdutoFormState): {
  valido: boolean;
  erros: ProdutoFormErros;
  precoAtualNum: number;
  precoOriginalNum: number | null;
  validoAteValor: string | null;
  cupomValor: string | null;
} {
  const erros: ProdutoFormErros = {};

  if (!isHttpsUrl(form.linkOriginal)) {
    erros.linkOriginal = 'Informe uma URL válida iniciando com https://';
  }

  const tituloLimpo = form.titulo.trim();
  if (!tituloLimpo) {
    erros.titulo = 'O título do produto é obrigatório.';
  } else if (tituloLimpo.length > PRODUTO_LIMITES.TITULO_MAX) {
    erros.titulo = `O título deve ter no máximo ${PRODUTO_LIMITES.TITULO_MAX} caracteres.`;
  }

  if (form.descricao.trim().length > PRODUTO_LIMITES.DESCRICAO_MAX) {
    erros.descricao = `A descrição deve ter no máximo ${PRODUTO_LIMITES.DESCRICAO_MAX} caracteres.`;
  }

  if (!isValidWebUrl(form.imagemUrl)) {
    erros.imagemUrl = 'Informe uma URL de imagem válida (https:// ou http://).';
  }

  const precoAtualNum = parsePrecoInput(form.precoAtual);
  if (!Number.isFinite(precoAtualNum) || precoAtualNum <= 0) {
    erros.precoAtual = 'O preço atual deve ser maior que zero.';
  }

  let precoOriginalNum: number | null = null;
  if (form.precoOriginal.trim() !== '') {
    const orig = parsePrecoInput(form.precoOriginal);
    if (!Number.isFinite(orig) || orig <= 0) {
      erros.precoOriginal = 'Informe um preço original válido.';
    } else if (Number.isFinite(precoAtualNum) && orig < precoAtualNum) {
      erros.precoOriginal = 'O preço original deve ser maior ou igual ao preço atual.';
    } else {
      precoOriginalNum = orig;
    }
  }

  if (form.linkAfiliado.trim() !== '' && !isValidWebUrl(form.linkAfiliado)) {
    erros.linkAfiliado = 'O link de afiliado deve ser uma URL válida.';
  }

  let validoAteValor: string | null = null;
  if (form.validoAte.trim() !== '') {
    try {
      validoAteValor = normalizarValidoAte(form.validoAte);
    } catch {
      erros.validoAte = 'Informe uma data de validade válida (AAAA-MM-DD).';
    }
  }

  const cupomLimpo = (form.cupom ?? '').trim();
  if (cupomLimpo.length > PRODUTO_LIMITES.CUPOM_MAX) {
    erros.cupom = `O cupom deve ter no máximo ${PRODUTO_LIMITES.CUPOM_MAX} caracteres.`;
  }
  const cupomValor = cupomLimpo ? cupomLimpo.slice(0, PRODUTO_LIMITES.CUPOM_MAX) : null;

  return {
    valido: Object.keys(erros).length === 0,
    erros,
    precoAtualNum,
    precoOriginalNum,
    validoAteValor,
    cupomValor,
  };
}

export type OrdenacaoAdmin = 'mais_recentes' | 'mais_clicados';

export interface FiltrosAdminProdutos {
  busca: string;
  status: 'todos' | StatusProduto;
  plataforma: 'todas' | Plataforma;
  ordenacao?: OrdenacaoAdmin;
}

export function extrairTimestampMs(valor: Produto['criadoEm'] | Produto['atualizadoEm']): number {
  if (!valor) return 0;
  if (valor instanceof Date) return valor.getTime();
  if (typeof (valor as { toMillis?: () => number }).toMillis === 'function') {
    return (valor as { toMillis: () => number }).toMillis();
  }
  if (typeof (valor as { toDate?: () => Date }).toDate === 'function') {
    return (valor as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export function filtrarProdutosAdmin(
  produtos: readonly Produto[],
  filtros: FiltrosAdminProdutos
): Produto[] {
  const termo = filtros.busca.trim().toLowerCase();

  const filtrados = produtos.filter((produto) => {
    if (filtros.status !== 'todos' && produto.status !== filtros.status) {
      return false;
    }
    if (filtros.plataforma !== 'todas' && produto.plataforma !== filtros.plataforma) {
      return false;
    }
    if (termo && !produto.titulo.toLowerCase().includes(termo)) {
      return false;
    }
    return true;
  });

  if (filtros.ordenacao === 'mais_clicados') {
    return [...filtrados].sort((a, b) => {
      if (b.cliques !== a.cliques) return b.cliques - a.cliques;
      return extrairTimestampMs(b.criadoEm) - extrairTimestampMs(a.criadoEm);
    });
  }

  return filtrados;
}

export function calcularDescontoPercentual(
  precoAtual: number,
  precoOriginal: number | null
): number | null {
  if (!precoOriginal || precoOriginal <= precoAtual || precoAtual <= 0) {
    return null;
  }
  const pct = Math.round(((precoOriginal - precoAtual) / precoOriginal) * 100);
  return pct > 0 ? pct : null;
}

export function formatarMoeda(valor: number, moeda = 'BRL'): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: moeda || 'BRL',
  });
}

export function formatarDataProduto(
  valor: Produto['criadoEm']
): string {
  if (!valor) return 'Agora';
  let data: Date;
  if (valor instanceof Date) {
    data = valor;
  } else if (typeof (valor as { toDate?: () => Date }).toDate === 'function') {
    data = (valor as { toDate: () => Date }).toDate();
  } else {
    return 'Agora';
  }
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function obterDataHojeIsoLocal(referencia: Date = new Date()): string {
  const ano = referencia.getFullYear();
  const mes = String(referencia.getMonth() + 1).padStart(2, '0');
  const dia = String(referencia.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function produtoEstaExpirado(
  produto: Pick<Produto, 'status' | 'validoAte'>,
  referencia: Date = new Date()
): boolean {
  if (produto.status === 'expirado') return true;
  const validoAte = produto.validoAte?.trim();
  if (!validoAte || !PRODUTO_LIMITES.DATA_ISO_REGEX.test(validoAte)) {
    return false;
  }
  return validoAte < obterDataHojeIsoLocal(referencia);
}

export function formatarDataIsoBr(valor: string | null | undefined): string {
  if (!valor || !PRODUTO_LIMITES.DATA_ISO_REGEX.test(valor.trim())) return '';
  const [ano, mes, dia] = valor.trim().split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarTempoRelativo(
  valor: Produto['atualizadoEm'],
  referencia: Date = new Date()
): string {
  const ms = extrairTimestampMs(valor);
  if (!ms) return '';
  const diffSegundos = Math.max(0, Math.floor((referencia.getTime() - ms) / 1000));
  if (diffSegundos < 60) {
    return 'Preço conferido agora';
  }
  const diffMinutos = Math.floor(diffSegundos / 60);
  if (diffMinutos < 60) {
    return `Preço conferido há ${diffMinutos} min`;
  }
  const diffHoras = Math.floor(diffMinutos / 60);
  if (diffHoras < 24) {
    return `Preço conferido há ${diffHoras} h`;
  }
  const diffDias = Math.floor(diffHoras / 24);
  return diffDias === 1
    ? 'Preço conferido há 1 dia'
    : `Preço conferido há ${diffDias} dias`;
}
