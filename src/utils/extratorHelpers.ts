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
    .replace(/[^\d.,]/g, '')
    .replace(/^[.,]+|[.,]+$/g, '');
  if (!str) return null;

  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const partes = str.split(',');
    str = partes.length > 2 ? partes.join('') : str.replace(',', '.');
  } else if (str.includes('.')) {
    if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    } else if (str.split('.').length > 2) {
      return null;
    }
  }

  const num = Number(str);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

export interface PrecosTextoBrl {
  precoAtual: number | null;
  precoOriginal: number | null;
}

export function extrairPrecosDeTextoBrl(texto: string): PrecosTextoBrl {
  if (!texto) return { precoAtual: null, precoOriginal: null };
  const regex = /R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
  const candidatos: Array<{
    valor: number;
    index: number;
    endIndex: number;
    papel: 'atual' | 'original' | 'neutro';
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    const rawNum = match[1];
    if (!rawNum) continue;
    const valor = normalizarNumeroPreco(rawNum);
    if (valor === null) continue;

    const inicio = match.index;
    const contextoAntes = texto.slice(Math.max(0, inicio - 40), inicio);

    // Ignora parcelas (ex.: "12x de R$ 349,90", "10x R$ 419,90", "parcelas de R$ ...")
    if (
      /(?:\d+\s*x\s*(?:de\s*)?|parcelas?\s*(?:de\s*)?|em\s+at[eé]\s+\d+\s*x\s*(?:de\s*)?)$/i.test(
        contextoAntes
      )
    ) {
      continue;
    }

    // Ignora valores de frete grátis, desconto absoluto, cupom mínimo ou cashback
    if (
      /(?:acima\s+de|compras\s+(?:de|acima|a\s+partir\s+de)|pedidos\s+(?:de|acima|a\s+partir\s+de)|frete\s+gr[aá]tis[^\n]{0,25}|economize(?:\s+at[eé])?|desconto\s+de|off\s+de|(?:cupom|cashback|b[oô]nus|vale|entrada|juros)\s*(?:de\s*)?)\s*$/i.test(
        contextoAntes
      )
    ) {
      continue;
    }

    let papel: 'atual' | 'original' | 'neutro' = 'neutro';
    if (/\b(?:de|antes|era|tabela|original)\s*:?\s*$/i.test(contextoAntes)) {
      papel = 'original';
    } else if (
      /\b(?:por|agora|a\s+vista|(?:no\s+)?pix)(?:\s+(?:apenas|somente|s[oó]))?\s*:?\s*$/i.test(
        contextoAntes
      )
    ) {
      papel = 'atual';
    }

    candidatos.push({
      valor,
      index: inicio,
      endIndex: inicio + match[0].length,
      papel,
    });
  }

  if (candidatos.length === 0) {
    return { precoAtual: null, precoOriginal: null };
  }

  const explicitAtual = candidatos.find((c) => c.papel === 'atual');
  const explicitOriginal = candidatos.find((c) => c.papel === 'original');

  if (explicitAtual && explicitOriginal) {
    if (explicitOriginal.valor > explicitAtual.valor) {
      return { precoAtual: explicitAtual.valor, precoOriginal: explicitOriginal.valor };
    }
    return { precoAtual: explicitAtual.valor, precoOriginal: null };
  }

  if (explicitAtual) {
    const outroMaior = candidatos.find(
      (c) => c !== explicitAtual && c.valor > explicitAtual.valor
    );
    return {
      precoAtual: explicitAtual.valor,
      precoOriginal: outroMaior ? outroMaior.valor : null,
    };
  }

  if (explicitOriginal) {
    const outroMenor = candidatos.find(
      (c) => c !== explicitOriginal && c.valor < explicitOriginal.valor
    );
    if (outroMenor) {
      return { precoAtual: outroMenor.valor, precoOriginal: explicitOriginal.valor };
    }
    // Nunca promove um "De R$ ..." isolado para preço atual sem ter o preço promocional
    return { precoAtual: null, precoOriginal: null };
  }

  // Sem palavras-chave explícitas: se houver dois preços próximos (ex.: "R$ 5.399 R$ 4.199"),
  // o maior é o anterior e o menor é o atual
  if (candidatos.length >= 2) {
    const primeiro = candidatos[0];
    const segundo = candidatos[1];
    if (segundo.index - primeiro.endIndex <= 45 && primeiro.valor !== segundo.valor) {
      const maior = Math.max(primeiro.valor, segundo.valor);
      const menor = Math.min(primeiro.valor, segundo.valor);
      if (maior <= menor * 5) {
        return { precoAtual: menor, precoOriginal: maior };
      }
    }
  }

  return { precoAtual: candidatos[0].valor, precoOriginal: null };
}

export function extrairPrecoDeTextoBrl(texto: string): number | null {
  return extrairPrecosDeTextoBrl(texto).precoAtual;
}

export function limparTituloMarketplace(titulo: string, plataforma: Plataforma): string {
  if (!titulo) return '';
  let t = titulo.trim();
  t = t.replace(/\s*[-–|]\s*R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*$/i, '');
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
    const curBlockMatch = html.match(
      /"current_price"\s*:\s*\{([^}]{0,260}"value"\s*:\s*"?\d+(?:[.,]\d+)*"?[^}]{0,260})\}/i
    );
    if (curBlockMatch?.[1]) {
      const blocoCur = curBlockMatch[1];
      const valMatch = blocoCur.match(/"value"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
      const curCurrencyMatch = blocoCur.match(/"currency"\s*:\s*"([A-Z]{3})"/i);
      const cur = valMatch?.[1] ? normalizarNumeroPreco(valMatch[1]) : null;
      if (cur !== null) {
        precoAtual = cur;
        confiancaPreco = 'alta';
        if (curCurrencyMatch?.[1]) moeda = curCurrencyMatch[1].toUpperCase();
      }

      // Busca previous_price / original_price / regular_amount apenas na janela próxima do preço principal
      const idxCur = curBlockMatch.index ?? 0;
      const janela = html.slice(Math.max(0, idxCur - 400), idxCur + 600);
      const prevBlockMatch = janela.match(
        /"previous_price"\s*:\s*\{([^}]{0,260}"value"\s*:\s*"?\d+(?:[.,]\d+)*"?[^}]{0,260})\}/i
      );
      if (prevBlockMatch?.[1]) {
        const prevValMatch = prevBlockMatch[1].match(/"value"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
        const prev = prevValMatch?.[1] ? normalizarNumeroPreco(prevValMatch[1]) : null;
        if (precoAtual !== null && prev !== null && prev > precoAtual) {
          precoOriginal = prev;
        }
      }
      if (precoOriginal === null) {
        const origInlineMatch = janela.match(
          /"(?:original_price|regular_amount|original_value|previous_price)"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i
        );
        const origVal = origInlineMatch?.[1] ? normalizarNumeroPreco(origInlineMatch[1]) : null;
        if (precoAtual !== null && origVal !== null && origVal > precoAtual) {
          precoOriginal = origVal;
        }
      }
    } else {
      const priceObjMatch = html.match(
        /"price"\s*:\s*\{([^}]{0,260}"amount"\s*:\s*"?\d+(?:[.,]\d+)*"?[^}]{0,260})\}/i
      );
      if (priceObjMatch?.[1]) {
        const amountMatch = priceObjMatch[1].match(/"amount"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
        const regMatch = priceObjMatch[1].match(
          /"(?:regular_amount|original_price|original_value)"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i
        );
        const cur = amountMatch?.[1] ? normalizarNumeroPreco(amountMatch[1]) : null;
        if (cur !== null) {
          precoAtual = cur;
          confiancaPreco = 'alta';
          const reg = regMatch?.[1] ? normalizarNumeroPreco(regMatch[1]) : null;
          if (reg !== null && reg > cur) {
            precoOriginal = reg;
          }
        }
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
    const ogTitleRaw = extrairMetaTagHtml(html, 'property', 'og:title');
    const daDescricao = extrairPrecosDeTextoBrl(descricao);
    const doTitulo = extrairPrecosDeTextoBrl(titulo);
    const doOgTitulo = extrairPrecosDeTextoBrl(ogTitleRaw);

    const escolhido =
      (daDescricao.precoAtual !== null && daDescricao.precoOriginal !== null
        ? daDescricao
        : null) ??
      (doTitulo.precoAtual !== null ? doTitulo : null) ??
      (doOgTitulo.precoAtual !== null ? doOgTitulo : null) ??
      (daDescricao.precoAtual !== null ? daDescricao : null);

    if (escolhido && escolhido.precoAtual !== null) {
      precoAtual = escolhido.precoAtual;
      if (precoOriginal === null && escolhido.precoOriginal !== null) {
        precoOriginal = escolhido.precoOriginal;
      }
      confiancaPreco = 'alta';
    }
  } else if (precoOriginal === null) {
    const daDescricao = extrairPrecosDeTextoBrl(descricao);
    if (
      daDescricao.precoOriginal !== null &&
      daDescricao.precoOriginal > precoAtual
    ) {
      precoOriginal = daDescricao.precoOriginal;
    }
  }

  if (precoAtual === null || (precoOriginal !== null && precoOriginal <= precoAtual)) {
    precoOriginal = null;
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

  const precosTitulo = extrairPrecosDeTextoBrl(tituloBruto);
  const precosDesc = extrairPrecosDeTextoBrl(descricao);

  const precoAtualServidor = normalizarNumeroPreco(dados.precoAtual);
  const precoAtual =
    precoAtualServidor ??
    (precosDesc.precoAtual !== null && precosDesc.precoOriginal !== null
      ? precosDesc.precoAtual
      : precosTitulo.precoAtual ?? precosDesc.precoAtual);

  const precoOriginalServidor = normalizarNumeroPreco(dados.precoOriginal);
  let precoOriginal =
    precoOriginalServidor ??
    precosDesc.precoOriginal ??
    precosTitulo.precoOriginal ??
    null;

  if (precoAtual === null || (precoOriginal !== null && precoOriginal <= precoAtual)) {
    precoOriginal = null;
  }

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
