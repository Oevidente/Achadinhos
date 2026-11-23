/**
 * Web App do Google Apps Script — Extrator de dados de produtos para Achadinhos Hub
 *
 * Expectativa realista sobre extração automática:
 * - Mercado Livre, Magalu: costuma funcionar bem para título, imagem e preço.
 * - Amazon: funciona em parte; às vezes bloqueia. O caminho oficial para dados e preço é a API de afiliados (PA-API), que exige conta de afiliado aprovada.
 * - Shopee e TikTok Shop: carregam o conteúdo por JavaScript e bloqueiam leitura automática com frequência. O fallback manual do painel é o plano B.
 * - Preço é o dado menos confiável de extrair. Por isso o aviso de confiança e a revisão do ADM.
 */

var TOKEN_SECRETO = 'TROQUE_POR_UM_TOKEN_FORTE_AQUI';
var CACHE_EXPIRACAO_SEGUNDOS = 6 * 60 * 60; // 6 horas

var PLATAFORMAS_DOMINIOS = {
  shopee: ['shopee.com.br', 's.shopee.com.br', 'shopee.com', 'shp.ee'],
  mercado_livre: ['mercadolivre.com.br', 'mercadolibre.com', 'produto.mercadolivre.com.br', 'meli.la'],
  amazon: ['amazon.com.br', 'amazon.com', 'amzn.to', 'a.co'],
  tiktok_shop: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'shop.tiktok.com'],
  magalu: ['magazineluiza.com.br', 'magalu.com', 'm.magazineluiza.com.br', 'divulgador.magalu.com'],
  aliexpress: ['aliexpress.com', 'pt.aliexpress.com', 's.click.aliexpress.com', 'a.aliexpress.com'],
  americanas: ['americanas.com.br'],
  kabum: ['kabum.com.br', 'tidd.ly'],
};

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var token = String(params.token || '').trim();
    var url = String(params.url || '').trim();

    if (!token || token !== TOKEN_SECRETO) {
      return responderJson({
        ok: false,
        erro: 'Token de autenticação inválido ou ausente.',
      });
    }

    if (!url || url.indexOf('https://') !== 0) {
      return responderJson({
        ok: false,
        erro: 'Informe uma URL válida iniciando com https://.',
      });
    }

    var hostname = extrairHostname_(url);
    var plataformaInicial = detectarPlataformaPorHost_(hostname);
    if (!hostname || plataformaInicial === 'outra') {
      return responderJson({
        ok: false,
        erro: 'Domínio não permitido. Apenas links de marketplaces autorizados são aceitos.',
      });
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = gerarChaveCache_(url);
    var cached = cache.get(cacheKey);
    if (cached) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    var resposta = UrlFetchApp.fetch(url, {
      method: 'get',
      followRedirects: true,
      muteHttpExceptions: true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    var statusCode = resposta.getResponseCode();
    if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
      return responderJson({
        ok: false,
        erro:
          'A loja bloqueou a leitura automática (HTTP ' +
          statusCode +
          '). Preencha os dados manualmente.',
      });
    }
    if (statusCode < 200 || statusCode >= 400) {
      return responderJson({
        ok: false,
        erro: 'Não foi possível acessar a página da loja (HTTP ' + statusCode + ').',
      });
    }

    var html = resposta.getContentText('UTF-8') || '';
    if (!html || html.length < 200) {
      return responderJson({
        ok: false,
        erro: 'A loja retornou uma página vazia ou protegida. Preencha os dados manualmente.',
      });
    }

    if (detectarBloqueioCaptcha_(html)) {
      return responderJson({
        ok: false,
        erro: 'A loja exibiu verificação anti-robô (captcha). Preencha os dados manualmente.',
      });
    }

    var extraido = extrairMetadadosProduto_(html, plataformaInicial);
    if (!extraido.titulo) {
      return responderJson({
        ok: false,
        erro:
          'Não foi possível encontrar o título do produto na página (conteúdo dinâmico ou bloqueado). Preencha manualmente.',
      });
    }

    var jsonStr = JSON.stringify(extraido);
    cache.put(cacheKey, jsonStr, CACHE_EXPIRACAO_SEGUNDOS);
    return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return responderJson({
      ok: false,
      erro: 'Erro interno ao processar o link: ' + (err && err.message ? err.message : String(err)),
    });
  }
}

function responderJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function gerarChaveCache_(url) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, url);
  var hex = digest
    .map(function (byte) {
      var v = byte < 0 ? byte + 256 : byte;
      return ('0' + v.toString(16)).slice(-2);
    })
    .join('');
  return 'prod_' + hex;
}

function extrairHostname_(url) {
  var match = url.match(/^https:\/\/([^\/:?#]+)/i);
  if (!match) return '';
  return match[1].toLowerCase().replace(/^www\./, '');
}

function detectarPlataformaPorHost_(host) {
  if (!host) return 'outra';
  var chaves = Object.keys(PLATAFORMAS_DOMINIOS);
  for (var i = 0; i < chaves.length; i++) {
    var plataforma = chaves[i];
    var dominios = PLATAFORMAS_DOMINIOS[plataforma];
    for (var j = 0; j < dominios.length; j++) {
      var dom = dominios[j].toLowerCase().replace(/^www\./, '');
      if (host === dom || host.slice(-(dom.length + 1)) === '.' + dom) {
        return plataforma;
      }
    }
  }
  return 'outra';
}

function detectarBloqueioCaptcha_(html) {
  var amostra = html.slice(0, 12000).toLowerCase();
  var possuiProduto =
    amostra.indexOf('application/ld+json') !== -1 || amostra.indexOf('og:title') !== -1;
  if (possuiProduto) return false;

  var sinais = [
    'captcha',
    'cf-challenge',
    'robot check',
    'are you a robot',
    'verify you are human',
    'acesso negado',
    'security check',
  ];
  for (var i = 0; i < sinais.length; i++) {
    if (amostra.indexOf(sinais[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function extrairMetadadosProduto_(html, plataformaFallback) {
  var avisos = [];
  var titulo = '';
  var descricao = '';
  var imagemUrl = '';
  var precoAtual = null;
  var precoOriginal = null;
  var moeda = 'BRL';
  var confiancaPreco = 'nao_encontrado';

  // Atualiza plataforma caso o link curto tenha redirecionado para um canonical conhecido
  var urlCanonica =
    extrairMetaTag_(html, 'property', 'og:url') || extrairLinkRel_(html, 'canonical');
  var plataforma = plataformaFallback;
  if (urlCanonica && urlCanonica.indexOf('https://') === 0) {
    var hostCanonico = extrairHostname_(urlCanonica);
    var detectada = detectarPlataformaPorHost_(hostCanonico);
    if (detectada !== 'outra') {
      plataforma = detectada;
    }
  }

  // 1. Prioridade: JSON-LD (@type: Product)
  var produtoJsonLd = extrairJsonLdProduto_(html);
  if (produtoJsonLd) {
    if (produtoJsonLd.name) titulo = limparTexto_(String(produtoJsonLd.name));
    if (produtoJsonLd.description) descricao = limparTexto_(String(produtoJsonLd.description));
    imagemUrl = extrairImagemDeJsonLd_(produtoJsonLd.image);

    var oferta = extrairOfertaJsonLd_(produtoJsonLd.offers);
    if (oferta && oferta.preco !== null) {
      precoAtual = oferta.preco;
      moeda = oferta.moeda || 'BRL';
      confiancaPreco = 'alta';
    }
  }

  // 2. Meta tags (og:*, product:price:*, twitter:*, itemprop="price")
  if (!titulo) {
    titulo =
      extrairMetaTag_(html, 'property', 'og:title') ||
      extrairMetaTag_(html, 'name', 'twitter:title');
  }
  if (!descricao) {
    descricao =
      extrairMetaTag_(html, 'property', 'og:description') ||
      extrairMetaTag_(html, 'name', 'twitter:description') ||
      extrairMetaTag_(html, 'name', 'description');
  }
  if (!imagemUrl) {
    imagemUrl =
      extrairMetaTag_(html, 'property', 'og:image') ||
      extrairMetaTag_(html, 'name', 'twitter:image');
  }

  if (precoAtual === null) {
    var precoMeta =
      extrairMetaTag_(html, 'property', 'product:price:amount') ||
      extrairMetaTag_(html, 'property', 'og:price:amount') ||
      extrairMetaTag_(html, 'itemprop', 'price');
    var moedaMeta =
      extrairMetaTag_(html, 'property', 'product:price:currency') ||
      extrairMetaTag_(html, 'property', 'og:price:currency');

    var precoParsed = normalizarNumeroPreco_(precoMeta);
    if (precoParsed !== null && precoParsed > 0) {
      precoAtual = precoParsed;
      if (moedaMeta) moeda = moedaMeta.toUpperCase().slice(0, 10);
      confiancaPreco = 'baixa';
      avisos.push('Preço obtido via meta tag; confira o valor final na loja.');
    }
  }

  // 3. Último recurso: <title>
  if (!titulo) {
    var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      titulo = limparTexto_(titleMatch[1]);
      avisos.push('Título extraído da tag <title>; verifique se precisa de ajuste.');
    }
  }

  if (precoAtual === null) {
    confiancaPreco = 'nao_encontrado';
    avisos.push('Não foi possível identificar o preço automaticamente.');
  }

  return {
    ok: true,
    plataforma: plataforma,
    titulo: titulo.slice(0, 200),
    descricao: descricao.slice(0, 2000),
    imagemUrl: garantirUrlHttpsOuHttp_(imagemUrl).slice(0, 2048),
    precoAtual: precoAtual,
    precoOriginal: precoOriginal,
    moeda: moeda,
    confiancaPreco: confiancaPreco,
    avisos: avisos,
  };
}

function extrairJsonLdProduto_(html) {
  var regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var match;
  while ((match = regex.exec(html)) !== null) {
    var conteudo = (match[1] || '').trim();
    if (!conteudo) continue;
    try {
      var parsed = JSON.parse(conteudo);
      var encontrado = buscarTipoProductEmObjeto_(parsed);
      if (encontrado) return encontrado;
    } catch (e) {
      // Ignora blocos JSON-LD malformados
    }
  }
  return null;
}

function buscarTipoProductEmObjeto_(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      var item = buscarTipoProductEmObjeto_(obj[i]);
      if (item) return item;
    }
    return null;
  }
  if (typeof obj === 'object') {
    var tipo = obj['@type'];
    if (
      tipo === 'Product' ||
      (Array.isArray(tipo) && tipo.indexOf('Product') !== -1)
    ) {
      return obj;
    }
    if (Array.isArray(obj['@graph'])) {
      return buscarTipoProductEmObjeto_(obj['@graph']);
    }
  }
  return null;
}

function extrairImagemDeJsonLd_(imageField) {
  if (!imageField) return '';
  if (typeof imageField === 'string') return imageField.trim();
  if (Array.isArray(imageField) && imageField.length > 0) {
    return extrairImagemDeJsonLd_(imageField[0]);
  }
  if (typeof imageField === 'object' && imageField.url) {
    return String(imageField.url).trim();
  }
  return '';
}

function extrairOfertaJsonLd_(offers) {
  if (!offers) return null;
  var lista = Array.isArray(offers) ? offers : [offers];
  for (var i = 0; i < lista.length; i++) {
    var o = lista[i];
    if (!o || typeof o !== 'object') continue;
    var bruto = o.price !== undefined ? o.price : o.lowPrice;
    var num = normalizarNumeroPreco_(bruto);
    if (num !== null && num > 0) {
      return {
        preco: num,
        moeda: o.priceCurrency ? String(o.priceCurrency).toUpperCase().slice(0, 10) : 'BRL',
      };
    }
    if (o.offers) {
      var nested = extrairOfertaJsonLd_(o.offers);
      if (nested) return nested;
    }
  }
  return null;
}

function extrairMetaTag_(html, attrName, attrValue) {
  var escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var regex1 = new RegExp(
    '<meta[^>]*' +
      attrName +
      '=["\']' +
      escaped +
      '["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',
    'i'
  );
  var m1 = html.match(regex1);
  if (m1 && m1[1]) return limparTexto_(m1[1]);

  var regex2 = new RegExp(
    '<meta[^>]*content=["\']([^"\']*)["\'][^>]*' +
      attrName +
      '=["\']' +
      escaped +
      '["\'][^>]*>',
    'i'
  );
  var m2 = html.match(regex2);
  if (m2 && m2[1]) return limparTexto_(m2[1]);

  return '';
}

function extrairLinkRel_(html, relValue) {
  var escaped = relValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var regex = new RegExp(
    '<link[^>]*rel=["\']' + escaped + '["\'][^>]*href=["\']([^"\']*)["\'][^>]*>',
    'i'
  );
  var m = html.match(regex);
  return m && m[1] ? m[1].trim() : '';
}

function limparTexto_(texto) {
  if (!texto) return '';
  return texto
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarNumeroPreco_(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') {
    return isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
  }
  var str = String(valor).trim().replace(/[^\d.,]/g, '');
  if (!str) return null;

  // Se houver vírgula como separador decimal (ex: 1.299,90 ou 99,90)
  if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.indexOf(',') !== -1) {
    str = str.replace(',', '.');
  }

  var num = Number(str);
  return isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

function garantirUrlHttpsOuHttp_(url) {
  if (!url) return '';
  var limpa = url.trim();
  if (limpa.indexOf('//') === 0) return 'https:' + limpa;
  if (/^https?:\/\//i.test(limpa)) return limpa;
  return '';
}
