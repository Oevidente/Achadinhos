import type { Plataforma, Produto } from '../types/produto';
import {
  calcularDescontoPercentual,
  extrairTimestampMs,
  produtoEstaExpirado,
} from './adminHelpers';

export type OrdenacaoVitrine = 'mais_recentes' | 'menor_preco' | 'maior_desconto';

export const PLATAFORMAS_PRINCIPAIS_VITRINE: readonly Plataforma[] = [
  'shopee',
  'mercado_livre',
  'amazon',
  'tiktok_shop',
  'magalu',
];

export interface FiltrosVitrine {
  busca: string;
  plataforma: 'todas' | Plataforma;
  ordenacao: OrdenacaoVitrine;
}

export function obterPlataformasFiltro(
  produtos: readonly Produto[],
  referencia: Date = new Date()
): Plataforma[] {
  const resultado: Plataforma[] = [...PLATAFORMAS_PRINCIPAIS_VITRINE];
  const jaIncluidas = new Set<Plataforma>(resultado);

  for (const produto of produtos) {
    if (
      produto.status === 'ativo' &&
      !produtoEstaExpirado(produto, referencia) &&
      !jaIncluidas.has(produto.plataforma)
    ) {
      jaIncluidas.add(produto.plataforma);
      resultado.push(produto.plataforma);
    }
  }

  return resultado;
}

export function filtrarEOrdenarVitrine(
  produtos: readonly Produto[],
  filtros: FiltrosVitrine,
  referencia: Date = new Date()
): Produto[] {
  const termo = filtros.busca.trim().toLowerCase();

  const filtrados = produtos.filter((produto) => {
    if (produto.status !== 'ativo') return false;
    if (produtoEstaExpirado(produto, referencia)) return false;
    if (filtros.plataforma !== 'todas' && produto.plataforma !== filtros.plataforma) {
      return false;
    }
    if (termo) {
      const noTitulo = produto.titulo.toLowerCase().includes(termo);
      const naDesc = produto.descricao.toLowerCase().includes(termo);
      const noCupom = (produto.cupom ?? '').toLowerCase().includes(termo);
      if (!noTitulo && !naDesc && !noCupom) return false;
    }
    return true;
  });

  const ordenados = [...filtrados];
  if (filtros.ordenacao === 'menor_preco') {
    ordenados.sort((a, b) => a.precoAtual - b.precoAtual);
  } else if (filtros.ordenacao === 'maior_desconto') {
    ordenados.sort((a, b) => {
      const descA = calcularDescontoPercentual(a.precoAtual, a.precoOriginal) ?? 0;
      const descB = calcularDescontoPercentual(b.precoAtual, b.precoOriginal) ?? 0;
      if (descB !== descA) return descB - descA;
      return extrairTimestampMs(b.criadoEm) - extrairTimestampMs(a.criadoEm);
    });
  } else {
    ordenados.sort((a, b) => extrairTimestampMs(b.criadoEm) - extrairTimestampMs(a.criadoEm));
  }

  return ordenados;
}

export function obterUrlDestinoOferta(
  produto: Pick<Produto, 'linkAfiliado' | 'linkOriginal'>
): string {
  const afiliado = produto.linkAfiliado?.trim();
  return afiliado || produto.linkOriginal;
}
