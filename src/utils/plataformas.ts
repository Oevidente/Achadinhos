import type { Plataforma } from '../types/produto';

export interface ConfiguracaoPlataforma {
  id: Plataforma;
  nome: string;
  corSelo: string;
  dominios: string[];
}

export const PLATAFORMAS_CONFIG: Record<Plataforma, ConfiguracaoPlataforma> = {
  shopee: {
    id: 'shopee',
    nome: 'Shopee',
    corSelo: '#EE4D2D',
    dominios: ['shopee.com.br', 's.shopee.com.br', 'shopee.com', 'shp.ee'],
  },
  mercado_livre: {
    id: 'mercado_livre',
    nome: 'Mercado Livre',
    corSelo: '#FFE600',
    dominios: ['mercadolivre.com.br', 'mercadolibre.com', 'produto.mercadolivre.com.br', 'meli.la'],
  },
  amazon: {
    id: 'amazon',
    nome: 'Amazon',
    corSelo: '#FF9900',
    dominios: ['amazon.com.br', 'amazon.com', 'amzn.to', 'a.co'],
  },
  tiktok_shop: {
    id: 'tiktok_shop',
    nome: 'TikTok Shop',
    corSelo: '#FE2C55',
    dominios: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'shop.tiktok.com'],
  },
  magalu: {
    id: 'magalu',
    nome: 'Magalu',
    corSelo: '#0086FF',
    dominios: ['magazineluiza.com.br', 'magalu.com', 'm.magazineluiza.com.br', 'divulgador.magalu.com'],
  },
  aliexpress: {
    id: 'aliexpress',
    nome: 'AliExpress',
    corSelo: '#E62E04',
    dominios: ['aliexpress.com', 'pt.aliexpress.com', 's.click.aliexpress.com', 'a.aliexpress.com'],
  },
  americanas: {
    id: 'americanas',
    nome: 'Americanas',
    corSelo: '#E60014',
    dominios: ['americanas.com.br'],
  },
  kabum: {
    id: 'kabum',
    nome: 'KaBuM!',
    corSelo: '#FF6500',
    dominios: ['kabum.com.br', 'tidd.ly'],
  },
  outra: {
    id: 'outra',
    nome: 'Outra loja',
    corSelo: '#64748B',
    dominios: [],
  },
};

function extrairHostname(urlBruta: string): string | null {
  const limpa = urlBruta.trim();
  if (!limpa) return null;

  const comEsquema = /^https?:\/\//i.test(limpa) ? limpa : `https://${limpa}`;
  try {
    const parsed = new URL(comEsquema);
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes('.')) return null;
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function detectarPlataforma(url: string): Plataforma {
  const host = extrairHostname(url);
  if (!host) return 'outra';

  const plataformasConhecidas = Object.values(PLATAFORMAS_CONFIG).filter(
    (config) => config.id !== 'outra'
  );

  for (const config of plataformasConhecidas) {
    const corresponde = config.dominios.some((dominio) => {
      const domNormalizado = dominio.toLowerCase().replace(/^www\./, '');
      return host === domNormalizado || host.endsWith(`.${domNormalizado}`);
    });
    if (corresponde) {
      return config.id;
    }
  }

  return 'outra';
}
