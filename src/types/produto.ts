import type { Timestamp } from 'firebase/firestore';

export const PLATAFORMAS = [
  'shopee',
  'mercado_livre',
  'amazon',
  'tiktok_shop',
  'magalu',
  'aliexpress',
  'americanas',
  'kabum',
  'outra',
] as const;

export type Plataforma = (typeof PLATAFORMAS)[number];

export const STATUS_PRODUTO = ['ativo', 'inativo', 'expirado'] as const;
export type StatusProduto = (typeof STATUS_PRODUTO)[number];

export const ORIGENS_DADOS = ['manual', 'automatico'] as const;
export type OrigemDadosProduto = (typeof ORIGENS_DADOS)[number];

export interface Produto {
  id: string;
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
  validoAte?: string | null;
  cupom?: string | null;
  criadoEm: Timestamp | Date | null;
  atualizadoEm: Timestamp | Date | null;
}

export interface CriarProdutoInput {
  titulo: string;
  descricao?: string;
  imagemUrl?: string;
  precoAtual: number;
  precoOriginal?: number | null;
  moeda?: string;
  plataforma?: Plataforma;
  linkOriginal: string;
  linkAfiliado?: string | null;
  status?: StatusProduto;
  origemDados?: OrigemDadosProduto;
  destaque?: boolean;
  cliques?: number;
  validoAte?: string | null;
  cupom?: string | null;
}

export type AtualizarProdutoInput = Partial<Omit<CriarProdutoInput, 'cliques'>> & {
  cliques?: number;
};
