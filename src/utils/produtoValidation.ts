import {
  ORIGENS_DADOS,
  PLATAFORMAS,
  STATUS_PRODUTO,
  type AtualizarProdutoInput,
  type CriarProdutoInput,
  type OrigemDadosProduto,
  type Plataforma,
  type StatusProduto,
} from '../types/produto';
import { detectarPlataforma } from './plataformas';

export const PRODUTO_LIMITES = {
  TITULO_MAX: 200,
  DESCRICAO_MAX: 2000,
  URL_MAX: 2048,
  MOEDAS_PERMITIDAS: ['BRL', 'USD', 'EUR'] as const,
  ID_REGEX: /^[a-zA-Z0-9_-]{1,128}$/,
  DATA_ISO_REGEX: /^\d{4}-\d{2}-\d{2}$/,
};

export interface ProdutoPayloadSanitizado {
  titulo: string;
  descricao: string;
  imagemUrl: string;
  precoAtual: number;
  precoOriginal: number | null;
  moeda: string;
  plataforma: Plataforma;
  linkOriginal: string;
  linkAfiliado: string | null;
  status: StatusProduto;
  origemDados: OrigemDadosProduto;
  destaque: boolean;
  cliques: number;
  validoAte: string | null;
}

export function validarIdDocumento(id: string): string {
  const limpo = id.trim();
  if (!PRODUTO_LIMITES.ID_REGEX.test(limpo)) {
    throw new Error('ID do produto inválido.');
  }
  return limpo;
}

function normalizarMoeda(moeda?: string): string {
  const valor = (moeda ?? 'BRL').trim().toUpperCase();
  if (!PRODUTO_LIMITES.MOEDAS_PERMITIDAS.includes(valor as 'BRL' | 'USD' | 'EUR')) {
    return 'BRL';
  }
  return valor;
}

function normalizarPlataforma(plataforma: Plataforma | undefined, linkOriginal: string): Plataforma {
  if (plataforma && PLATAFORMAS.includes(plataforma)) {
    return plataforma;
  }
  return detectarPlataforma(linkOriginal);
}

export function normalizarValidoAte(valor?: string | null): string | null {
  if (valor === null || valor === undefined) return null;
  const limpo = valor.trim();
  if (!limpo) return null;
  if (!PRODUTO_LIMITES.DATA_ISO_REGEX.test(limpo)) {
    throw new Error('A data de validade deve estar no formato AAAA-MM-DD.');
  }
  const [ano, mes, dia] = limpo.split('-').map(Number);
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    dt.getUTCFullYear() !== ano ||
    dt.getUTCMonth() !== mes - 1 ||
    dt.getUTCDate() !== dia
  ) {
    throw new Error('Data de validade inválida.');
  }
  return limpo;
}

export function sanitizarCriacaoProduto(input: CriarProdutoInput): ProdutoPayloadSanitizado {
  const titulo = input.titulo.trim().slice(0, PRODUTO_LIMITES.TITULO_MAX);
  if (!titulo) {
    throw new Error('O título do produto é obrigatório.');
  }

  const linkOriginal = input.linkOriginal.trim().slice(0, PRODUTO_LIMITES.URL_MAX);
  if (!linkOriginal) {
    throw new Error('O link original do produto é obrigatório.');
  }

  const precoAtual = Number(input.precoAtual);
  if (!Number.isFinite(precoAtual) || precoAtual < 0) {
    throw new Error('O preço atual deve ser um número maior ou igual a zero.');
  }

  let precoOriginal: number | null = null;
  if (input.precoOriginal !== null && input.precoOriginal !== undefined) {
    const numOriginal = Number(input.precoOriginal);
    if (!Number.isFinite(numOriginal) || numOriginal < 0) {
      throw new Error('O preço original deve ser um número maior ou igual a zero.');
    }
    precoOriginal = numOriginal;
  }

  const descricao = (input.descricao ?? '').trim().slice(0, PRODUTO_LIMITES.DESCRICAO_MAX);
  const imagemUrl = (input.imagemUrl ?? '').trim().slice(0, PRODUTO_LIMITES.URL_MAX);

  const linkAfiliadoBruto = input.linkAfiliado ? input.linkAfiliado.trim() : '';
  const linkAfiliado = linkAfiliadoBruto ? linkAfiliadoBruto.slice(0, PRODUTO_LIMITES.URL_MAX) : null;

  const status: StatusProduto =
    input.status && STATUS_PRODUTO.includes(input.status) ? input.status : 'ativo';

  const origemDados: OrigemDadosProduto =
    input.origemDados && ORIGENS_DADOS.includes(input.origemDados) ? input.origemDados : 'manual';

  const cliquesNum = Number(input.cliques ?? 0);
  const cliques = Number.isFinite(cliquesNum) && cliquesNum >= 0 ? Math.floor(cliquesNum) : 0;

  return {
    titulo,
    descricao,
    imagemUrl,
    precoAtual,
    precoOriginal,
    moeda: normalizarMoeda(input.moeda),
    plataforma: normalizarPlataforma(input.plataforma, linkOriginal),
    linkOriginal,
    linkAfiliado,
    status,
    origemDados,
    destaque: Boolean(input.destaque ?? false),
    cliques,
    validoAte: normalizarValidoAte(input.validoAte),
  };
}

export function sanitizarAtualizacaoProduto(
  input: AtualizarProdutoInput
): Partial<ProdutoPayloadSanitizado> {
  const resultado: Partial<ProdutoPayloadSanitizado> = {};

  if (input.titulo !== undefined) {
    const titulo = input.titulo.trim().slice(0, PRODUTO_LIMITES.TITULO_MAX);
    if (!titulo) throw new Error('O título do produto não pode ficar vazio.');
    resultado.titulo = titulo;
  }

  if (input.descricao !== undefined) {
    resultado.descricao = input.descricao.trim().slice(0, PRODUTO_LIMITES.DESCRICAO_MAX);
  }

  if (input.imagemUrl !== undefined) {
    resultado.imagemUrl = input.imagemUrl.trim().slice(0, PRODUTO_LIMITES.URL_MAX);
  }

  if (input.precoAtual !== undefined) {
    const preco = Number(input.precoAtual);
    if (!Number.isFinite(preco) || preco < 0) {
      throw new Error('O preço atual deve ser um número maior ou igual a zero.');
    }
    resultado.precoAtual = preco;
  }

  if (input.precoOriginal !== undefined) {
    if (input.precoOriginal === null) {
      resultado.precoOriginal = null;
    } else {
      const precoOrig = Number(input.precoOriginal);
      if (!Number.isFinite(precoOrig) || precoOrig < 0) {
        throw new Error('O preço original deve ser um número maior ou igual a zero.');
      }
      resultado.precoOriginal = precoOrig;
    }
  }

  if (input.moeda !== undefined) {
    resultado.moeda = normalizarMoeda(input.moeda);
  }

  if (input.linkOriginal !== undefined) {
    const link = input.linkOriginal.trim().slice(0, PRODUTO_LIMITES.URL_MAX);
    if (!link) throw new Error('O link original não pode ficar vazio.');
    resultado.linkOriginal = link;
  }

  if (input.plataforma !== undefined) {
    if (!PLATAFORMAS.includes(input.plataforma)) {
      throw new Error('Plataforma inválida.');
    }
    resultado.plataforma = input.plataforma;
  }

  if (input.linkAfiliado !== undefined) {
    const af = input.linkAfiliado ? input.linkAfiliado.trim() : '';
    resultado.linkAfiliado = af ? af.slice(0, PRODUTO_LIMITES.URL_MAX) : null;
  }

  if (input.status !== undefined) {
    if (!STATUS_PRODUTO.includes(input.status)) {
      throw new Error('Status inválido.');
    }
    resultado.status = input.status;
  }

  if (input.origemDados !== undefined) {
    if (!ORIGENS_DADOS.includes(input.origemDados)) {
      throw new Error('Origem de dados inválida.');
    }
    resultado.origemDados = input.origemDados;
  }

  if (input.destaque !== undefined) {
    resultado.destaque = Boolean(input.destaque);
  }

  if (input.cliques !== undefined) {
    const cliques = Number(input.cliques);
    if (!Number.isFinite(cliques) || cliques < 0) {
      throw new Error('Cliques deve ser um número maior ou igual a zero.');
    }
    resultado.cliques = Math.floor(cliques);
  }

  if (input.validoAte !== undefined) {
    resultado.validoAte = normalizarValidoAte(input.validoAte);
  }

  return resultado;
}
