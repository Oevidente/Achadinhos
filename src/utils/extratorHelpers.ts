import { PLATAFORMAS, type Plataforma } from '../types/produto';
import { isHttpsUrl } from './adminHelpers';
import { detectarPlataforma } from './plataformas';
import { PRODUTO_LIMITES } from './produtoValidation';

export type ConfiancaPreco = 'alta' | 'baixa' | 'nao_encontrado';

export interface ExtratorResultado {
  ok: true;
  plataforma: Plataforma;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  precoAtual: number | null;
  precoOriginal: number | null;
  moeda: string;
  confiancaPreco: ConfiancaPreco;
  avisos: string[];
}

export function isDominioPermitidoExtrator(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  return detectarPlataforma(url) !== 'outra';
}

export function montarUrlRequisicaoExtrator(
  endpointBase: string,
  token: string,
  targetUrl: string
): string {
  const endpoint = new URL(endpointBase);
  endpoint.searchParams.set('url', targetUrl.trim());
  endpoint.searchParams.set('token', token);
  return endpoint.toString();
}

export function formatarPrecoParaInput(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor) || valor <= 0) {
    return '';
  }
  return valor.toFixed(2).replace('.', ',');
}

export function limparTextoHtml(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarNumeroPreco(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
  }
  let str = String(valor)
    .trim()
    .replace(/[^\d.,]/g, '');
  if (!str) return null;

  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = Number(str);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

export function extrairPrecoDeTextoBrl(texto: string): number | null {
  if (!texto) return null;
  const match = texto.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}|\d+)/i);
  if (!match?.[1]) return null;
  return normalizarNumeroPreco(match[1]);
}

export function limparTituloMarketplace(titulo: string, plataforma: Plataforma): string {
  if (!titulo) return '';
  let t = titulo.trim();
  t = t.replace(/\s*[-–|]\s*R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*$/i, '');
  if (plataforma === 'shopee') {
    t = t.replace(/\s*\|\s*Shopee(?:\s+Brasil)?\s*$/i, '');
  } else if (plataforma === 'mercado_livre') {
    t = t.replace(/\s*\|\s*Mercado\s*Livre(?:\s+Brasil)?\s*$/i, '');
  } else if (plataforma === 'amazon') {
    t = t
      .replace(/\s*:\s*Amazon\.com(?:\.br)?\s*$/i, '')
      .replace(/\s*\|\s*Amazon(?:\.com\.br)?\s*$/i, '');
  } else if (plataforma === 'magalu') {
    t = t
      .replace(/\s*[-|]\s*Magazine\s*Luiza\s*$/i, '')
      .replace(/\s*\|\s*Magalu\s*$/i, '');
  } else if (plataforma === 'kabum') {
    t = t.replace(/\s*\|\s*KaBuM!\s*$/i, '');
  }
  return t.trim();
}

export function extrairOgInfoDeUrl(url: string): { titulo: string; imagemUrl: string } {
  try {
    const parsed = new URL(url);
    const bruto = parsed.searchParams.get('og_info');
    if (!bruto) return { titulo: '', imagemUrl: '' };
    const obj = JSON.parse(bruto) as Record<string, unknown>;
    return {
      titulo:
        typeof obj.title === 'string'
          ? limparTextoHtml(obj.title.replace(/\+/g, ' ')).slice(0, PRODUTO_LIMITES.TITULO_MAX)
          : '',
      imagemUrl:
        typeof obj.image === 'string' ? obj.image.trim().slice(0, PRODUTO_LIMITES.URL_MAX) : '',
    };
  } catch {
    return { titulo: '', imagemUrl: '' };
  }
}

export function extrairTituloDoSlugUrl(url: string, plataforma: Plataforma): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    if (plataforma === 'shopee') {
      const mShopee = pathname.match(/^\/([^/]+)-i\.\d+\.\d+/i);
      if (mShopee?.[1]) {
        return limparTextoHtml(decodeURIComponent(mShopee[1]).replace(/[-+]+/g, ' ')).slice(
          0,
          PRODUTO_LIMITES.TITULO_MAX
        );
      }
    }

    if (plataforma === 'mercado_livre') {
      const mMl = pathname.match(/^\/([^/]+)\/p\/MLB\d+/i);
      if (mMl?.[1]) {
        return limparTextoHtml(decodeURIComponent(mMl[1]).replace(/[-+]+/g, ' ')).slice(
          0,
          PRODUTO_LIMITES.TITULO_MAX
        );
      }
    }

    const partes = pathname.split('/').filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? '';
    if (
      ultimo.length > 10 &&
      ultimo.includes('-') &&
      !/^(social|view|product|dp|item)$/i.test(ultimo)
    ) {
      return limparTextoHtml(decodeURIComponent(ultimo).replace(/[-_+]+/g, ' ')).slice(
        0,
        PRODUTO_LIMITES.TITULO_MAX
      );
    }
  } catch {
    return '';
  }
  return '';
}

export function extrairMetadadosPelaUrlLocal(url: string): ExtratorResultado | null {
  const urlLimpa = url.trim();
  const plataforma = detectarPlataforma(urlLimpa);
  const ogInfo = extrairOgInfoDeUrl(urlLimpa);
  const titulo = ogInfo.titulo || extrairTituloDoSlugUrl(urlLimpa, plataforma);

  if (!titulo && !ogInfo.imagemUrl) {
    return null;
  }

  return {
    ok: true,
    plataforma,
    titulo: titulo.slice(0, PRODUTO_LIMITES.TITULO_MAX),
    descricao: '',
    imagemUrl: ogInfo.imagemUrl.slice(0, PRODUTO_LIMITES.URL_MAX),
    precoAtual: null,
    precoOriginal: null,
    moeda: 'BRL',
    confiancaPreco: 'nao_encontrado',
    avisos: [
      'Dados parciais extraídos diretamente do endereço do link. Configure o Google Apps Script para buscar preço e foto completos ou preencha o preço manualmente.',
    ],
  };
}

function extrairMetaTagHtml(html: string, attrName: string, attrValue: string): string {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const padroes = [
    `<meta[^>]*\\b${attrName}=["']${escaped}["'][^>]*\\bcontent="([^"]*)"[^>]*>`,
    `<meta[^>]*\\b${attrName}=["']${escaped}["'][^>]*\\bcontent='([^']*)'[^>]*>`,
    `<meta[^>]*\\bcontent="([^"]*)"[^>]*\\b${attrName}=["']${escaped}["'][^>]*>`,
    `<meta[^>]*\\bcontent='([^']*)'[^>]*\\b${attrName}=["']${escaped}["'][^>]*>`,
  ];
  for (const padrao of padroes) {
    const m = html.match(new RegExp(padrao, 'i'));
    if (m?.[1]) return limparTextoHtml(m[1]);
  }
  return '';
}

export function extrairMetadadosDeHtml(
  html: string,
  url: string,
  urlsVisitadas: string[] = [url]
): ExtratorResultado | null {
  const plataforma = detectarPlataforma(url);
  const avisos: string[] = [];
  let titulo = '';
  let descricao = '';
  let imagemUrl = '';
  let precoAtual: number | null = null;
  let precoOriginal: number | null = null;
  let moeda = 'BRL';
  let confiancaPreco: ConfiancaPreco = 'nao_encontrado';

  if (plataforma === 'tiktok_shop') {
    for (let i = urlsVisitadas.length - 1; i >= 0; i--) {
      const info = extrairOgInfoDeUrl(urlsVisitadas[i]);
      if (info.titulo && !titulo) titulo = info.titulo;
      if (info.imagemUrl && !imagemUrl) imagemUrl = info.imagemUrl;
    }
  }

  if (plataforma === 'mercado_livre') {
    const curMatch = html.match(
      /"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)(?:\s*,\s*"currency"\s*:\s*"([A-Z]{3})")?/i
    );
    if (curMatch?.[1]) {
      const cur = normalizarNumeroPreco(curMatch[1]);
      if (cur !== null) {
        precoAtual = cur;
        confiancaPreco = 'alta';
        if (curMatch[2]) moeda = curMatch[2].toUpperCase();
      }
    }
    const prevMatch = html.match(/"previous_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i);
    if (prevMatch?.[1]) {
      const prev = normalizarNumeroPreco(prevMatch[1]);
      if (prev !== null && prev > (precoAtual ?? 0)) {
        precoOriginal = prev;
      }
    }
    const titleJsonMatch = html.match(
      /"type"\s*:\s*"title"[\s\S]{0,120}?"text"\s*:\s*"([^"]{3,240})"/i
    );
    if (titleJsonMatch?.[1]) {
      titulo = limparTextoHtml(titleJsonMatch[1]);
    }
  }

  if (!titulo) {
    const ogTitle =
      extrairMetaTagHtml(html, 'property', 'og:title') ||
      extrairMetaTagHtml(html, 'name', 'twitter:title') ||
      extrairMetaTagHtml(html, 'name', 'title');
    if (ogTitle && ogTitle !== 'TikTok Shop' && ogTitle !== 'Security Check') {
      titulo = ogTitle;
    }
  }

  if (!descricao) {
    descricao =
      extrairMetaTagHtml(html, 'property', 'og:description') ||
      extrairMetaTagHtml(html, 'name', 'twitter:description') ||
      extrairMetaTagHtml(html, 'name', 'description');
  }

  if (!imagemUrl) {
    imagemUrl =
      extrairMetaTagHtml(html, 'property', 'og:image') ||
      extrairMetaTagHtml(html, 'name', 'twitter:image') ||
      extrairMetaTagHtml(html, 'name', 'image');
  }

  if (precoAtual === null) {
    const precoMeta =
      extrairMetaTagHtml(html, 'property', 'product:price:amount') ||
      extrairMetaTagHtml(html, 'property', 'og:price:amount') ||
      extrairMetaTagHtml(html, 'itemprop', 'price');
    const parsedMeta = normalizarNumeroPreco(precoMeta);
    if (parsedMeta !== null) {
      precoAtual = parsedMeta;
      confiancaPreco = 'baixa';
    }
  }

  if (precoAtual === null) {
    const precoTexto =
      extrairPrecoDeTextoBrl(titulo) ||
      extrairPrecoDeTextoBrl(extrairMetaTagHtml(html, 'property', 'og:title')) ||
      extrairPrecoDeTextoBrl(descricao);
    if (precoTexto !== null) {
      precoAtual = precoTexto;
      confiancaPreco = 'alta';
    }
  }

  if (!titulo) {
    titulo = extrairTituloDoSlugUrl(url, plataforma);
  }

  titulo = limparTituloMarketplace(titulo, plataforma);
  if (plataforma === 'shopee') {
    descricao = descricao.replace(/^Compre\s+[\s\S]{3,220}?\s+na\s+Shopee\s+Brasil!\s*/i, '').trim();
  }

  if (!titulo) return null;

  if (precoAtual === null) {
    avisos.push('Não foi possível identificar o preço automaticamente.');
  }

  return {
    ok: true,
    plataforma,
    titulo: titulo.slice(0, PRODUTO_LIMITES.TITULO_MAX),
    descricao: descricao.slice(0, PRODUTO_LIMITES.DESCRICAO_MAX),
    imagemUrl: imagemUrl.slice(0, PRODUTO_LIMITES.URL_MAX),
    precoAtual,
    precoOriginal,
    moeda,
    confiancaPreco,
    avisos,
  };
}

export function normalizarRespostaExtrator(
  payload: unknown,
  urlOriginal: string
): ExtratorResultado {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida do serviço extrator.');
  }

  const dados = payload as Record<string, unknown>;
  if (dados.ok !== true) {
    const motivo =
      typeof dados.erro === 'string' && dados.erro.trim()
        ? dados.erro.trim()
        : 'Não foi possível extrair os dados deste link.';
    throw new Error(motivo);
  }

  const plataformaBruta = String(dados.plataforma ?? '');
  const plataforma: Plataforma = PLATAFORMAS.includes(plataformaBruta as Plataforma)
    ? (plataformaBruta as Plataforma)
    : detectarPlataforma(urlOriginal);

  const tituloBruto =
    typeof dados.titulo === 'string'
      ? limparTituloMarketplace(dados.titulo, plataforma).slice(0, PRODUTO_LIMITES.TITULO_MAX)
      : '';

  const fallbackUrl = extrairMetadadosPelaUrlLocal(urlOriginal);
  const titulo = tituloBruto || fallbackUrl?.titulo || '';

  if (!titulo) {
    throw new Error('O extrator não encontrou o título do produto. Preencha manualmente.');
  }

  const descricao =
    typeof dados.descricao === 'string'
      ? dados.descricao.trim().slice(0, PRODUTO_LIMITES.DESCRICAO_MAX)
      : '';

  const imagemUrlBruta =
    typeof dados.imagemUrl === 'string'
      ? dados.imagemUrl.trim().slice(0, PRODUTO_LIMITES.URL_MAX)
      : '';
  const imagemUrl = imagemUrlBruta || fallbackUrl?.imagemUrl || '';

  const precoAtualNum =
    dados.precoAtual === null || dados.precoAtual === undefined
      ? null
      : Number(dados.precoAtual);
  const precoAtual =
    precoAtualNum !== null && Number.isFinite(precoAtualNum) && precoAtualNum > 0
      ? Math.round(precoAtualNum * 100) / 100
      : extrairPrecoDeTextoBrl(tituloBruto) ?? extrairPrecoDeTextoBrl(descricao);

  const precoOrigNum =
    dados.precoOriginal === null || dados.precoOriginal === undefined
      ? null
      : Number(dados.precoOriginal);
  const precoOriginal =
    precoOrigNum !== null && Number.isFinite(precoOrigNum) && precoOrigNum > 0
      ? Math.round(precoOrigNum * 100) / 100
      : null;

  const confiancaBruta = String(dados.confiancaPreco ?? '');
  const confiancaPreco: ConfiancaPreco =
    confiancaBruta === 'alta' || confiancaBruta === 'baixa' || confiancaBruta === 'nao_encontrado'
      ? confiancaBruta
      : precoAtual !== null
      ? 'baixa'
      : 'nao_encontrado';

  const moeda =
    typeof dados.moeda === 'string' && dados.moeda.trim()
      ? dados.moeda.trim().toUpperCase().slice(0, 10)
      : 'BRL';

  const avisos = Array.isArray(dados.avisos)
    ? dados.avisos.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];

  return {
    ok: true,
    plataforma,
    titulo,
    descricao,
    imagemUrl,
    precoAtual,
    precoOriginal,
    moeda,
    confiancaPreco,
    avisos,
  };
}
