/**
 * Web App do Google Apps Script — Extrator de dados de produtos para Achadinhos do Deco
 *
 * Estratégia por plataforma (100% gratuita, sem IA):
 * - Mercado Livre (incluindo links /social/... e meli.la): extrai título, imagem, preço atual e preço original (previous_price) do JSON embutido + meta tags.
 * - Shopee (incluindo s.shopee.com.br e shp.ee): usa User-Agent WhatsApp para receber as meta tags SSR (título, descrição, imagem) e tenta extrair preço se disponível.
 * - TikTok Shop (incluindo vt.tiktok.com): segue redirecionamentos manualmente para capturar o parâmetro `og_info` (título e imagem) mesmo quando há Security Check, além de tentar preço no HTML.
 * - Amazon, Magalu, AliExpress, Americanas, KaBuM!: JSON-LD + meta tags + fallback de moeda em texto + fallback de User-Agent.
 */

var TOKEN_SECRETO = 'TROQUE_POR_UM_TOKEN_FORTE_AQUI';
var CACHE_EXPIRACAO_SEGUNDOS = 6 * 60 * 60; // 6 horas

var UA_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var UA_WHATSAPP = 'WhatsApp/2.23.20.0 A';

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

    // Seleciona a ordem de User-Agents mais eficaz para cada plataforma
    var uasParaTentar =
      plataformaInicial === 'shopee'
        ? [UA_WHATSAPP, UA_CHROME]
        : [UA_CHROME, UA_WHATSAPP];

    var resultadoBusca = null;
    var extraido = null;
    var ultimoErroHttp = 0;
    var bloqueadoPorCaptcha = false;

    for (var u = 0; u < uasParaTentar.length; u++) {
      var tentativa = seguirRedirecionamentos_(url, uasParaTentar[u], 6);
      ultimoErroHttp = tentativa.statusCode;

      if (tentativa.statusCode >= 200 && tentativa.statusCode < 400) {
        var html = tentativa.html || '';
        var plataformaFinal = detectarPlataformaFinal_(
          tentativa.urlsVisitadas,
          html,
          plataformaInicial
        );
        var ehCaptcha = html.length < 200 || detectarBloqueioCaptcha_(html);

        var candidato = extrairMetadadosProduto_(
          html,
          plataformaFinal,
          tentativa.urlsVisitadas
        );

        if (candidato && candidato.titulo) {
          extraido = candidato;
          resultadoBusca = tentativa;
          if (ehCaptcha) {
            bloqueadoPorCaptcha = true;
          }
          // Se já temos título + preço (ou não é a primeira tentativa), encerra
          if (extraido.precoAtual !== null || u === uasParaTentar.length - 1) {
            break;
          }
          // Caso contrário (ex.: faltou preço), tenta o segundo UA se for ML ou genérico
          if (plataformaFinal === 'shopee' || plataformaFinal === 'tiktok_shop') {
            break;
          }
        } else if (ehCaptcha) {
          bloqueadoPorCaptcha = true;
        }
      } else {
        resultadoBusca = tentativa;
      }
    }

    if (!extraido || !extraido.titulo) {
      if (ultimoErroHttp === 403 || ultimoErroHttp === 429 || ultimoErroHttp === 503) {
        return responderJson({
          ok: false,
          erro:
            'A loja bloqueou a leitura automática (HTTP ' +
            ultimoErroHttp +
            '). Preencha os dados manualmente.',
        });
      }
      if (bloqueadoPorCaptcha) {
        return responderJson({
          ok: false,
          erro: 'A loja exibiu verificação anti-robô (captcha). Preencha os dados manualmente.',
        });
      }
      if (ultimoErroHttp > 0 && (ultimoErroHttp < 200 || ultimoErroHttp >= 400)) {
        return responderJson({
          ok: false,
          erro: 'Não foi possível acessar a página da loja (HTTP ' + ultimoErroHttp + ').',
        });
      }
      return responderJson({
        ok: false,
        erro:
          'Não foi possível encontrar o título do produto na página (conteúdo dinâmico ou bloqueado). Preencha manualmente.',
      });
    }

    if (bloqueadoPorCaptcha && extraido.precoAtual === null) {
      extraido.avisos.push(
        'A loja exibiu verificação anti-robô para o preço, mas título/imagem foram recuperados.'
      );
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

function seguirRedirecionamentos_(urlInicial, userAgent, maxHops) {
  var atual = urlInicial;
  var urlsVisitadas = [urlInicial];
  var cookieJar = {};

  for (var hop = 0; hop <= maxHops; hop++) {
    var headers = {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    };
    var cookieHeader = montarCookieHeader_(cookieJar);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    var resp = UrlFetchApp.fetch(atual, {
      method: 'get',
      followRedirects: false,
      muteHttpExceptions: true,
      headers: headers,
    });

    var respHeaders = resp.getAllHeaders ? resp.getAllHeaders() : resp.getHeaders();
    acumularCookies_(cookieJar, respHeaders);

    var status = resp.getResponseCode();
    if (status >= 300 && status < 400) {
      var location = obterHeaderCaseInsensitive_(respHeaders, 'location');
      if (location) {
        var proximo = resolverUrlRelativa_(atual, String(location).trim());
        if (proximo && urlsVisitadas.indexOf(proximo) === -1) {
          urlsVisitadas.push(proximo);
          atual = proximo;
          continue;
        }
      }
    }

    return {
      statusCode: status,
      urlFinal: atual,
      urlsVisitadas: urlsVisitadas,
      html: resp.getContentText('UTF-8') || '',
    };
  }

  return {
    statusCode: 200,
    urlFinal: atual,
    urlsVisitadas: urlsVisitadas,
    html: '',
  };
}

function obterHeaderCaseInsensitive_(headers, nome) {
  if (!headers) return '';
  var alvo = nome.toLowerCase();
  var keys = Object.keys(headers);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === alvo) {
      var val = headers[keys[i]];
      return Array.isArray(val) ? val[0] : val;
    }
  }
  return '';
}

function acumularCookies_(jar, headers) {
  if (!headers) return;
  var keys = Object.keys(headers);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === 'set-cookie') {
      var raw = headers[keys[i]];
      var list = Array.isArray(raw) ? raw : [raw];
      for (var j = 0; j < list.length; j++) {
        var parte = String(list[j] || '').split(';')[0].trim();
        var eq = parte.indexOf('=');
        if (eq > 0) {
          jar[parte.slice(0, eq).trim()] = parte.slice(eq + 1).trim();
        }
      }
    }
  }
}

function montarCookieHeader_(jar) {
  var pares = [];
  var keys = Object.keys(jar);
  for (var i = 0; i < keys.length; i++) {
    pares.push(keys[i] + '=' + jar[keys[i]]);
  }
  return pares.join('; ');
}

function resolverUrlRelativa_(base, destino) {
  if (!destino) return '';
  if (/^https?:\/\//i.test(destino)) return destino;
  if (destino.indexOf('//') === 0) return 'https:' + destino;
  var originMatch = base.match(/^(https?:\/\/[^\/?#]+)/i);
  if (!originMatch) return '';
  var origin = originMatch[1];
  if (destino.charAt(0) === '/') return origin + destino;
  var pathBase = base.replace(/[?#].*$/, '').replace(/\/[^\/]*$/, '/');
  return pathBase + destino;
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
  return 'prod_v3_' + hex;
}

function extrairHostname_(url) {
  var match = url.match(/^https?:\/\/([^\/:?#]+)/i);
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

function detectarPlataformaFinal_(urlsVisitadas, html, fallback) {
  for (var i = urlsVisitadas.length - 1; i >= 0; i--) {
    var det = detectarPlataformaPorHost_(extrairHostname_(urlsVisitadas[i]));
    if (det !== 'outra') return det;
  }
  var urlCanonica =
    extrairMetaTag_(html, 'property', 'og:url') || extrairLinkRel_(html, 'canonical');
  if (urlCanonica && urlCanonica.indexOf('https://') === 0) {
    var detCanon = detectarPlataformaPorHost_(extrairHostname_(urlCanonica));
    if (detCanon !== 'outra') return detCanon;
  }
  return fallback;
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
    'drag the puzzle piece',
  ];
  for (var i = 0; i < sinais.length; i++) {
    if (amostra.indexOf(sinais[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function extrairMetadadosProduto_(html, plataforma, urlsVisitadas) {
  var avisos = [];
  var titulo = '';
  var descricao = '';
  var imagemUrl = '';
  var precoAtual = null;
  var precoOriginal = null;
  var moeda = 'BRL';
  var confiancaPreco = 'nao_encontrado';

  var urlFinal =
    urlsVisitadas && urlsVisitadas.length > 0 ? urlsVisitadas[urlsVisitadas.length - 1] : '';

  // 0. Extração específica por plataforma (maior precisão)
  if (plataforma === 'tiktok_shop') {
    var infoTikTok = extrairOgInfoDeUrls_(urlsVisitadas || []);
    if (infoTikTok.titulo) titulo = infoTikTok.titulo;
    if (infoTikTok.imagemUrl) imagemUrl = infoTikTok.imagemUrl;
    var precoTikTok = extrairPrecoJsonEmbutido_(html, ['sku_price', 'real_price', 'sale_price']);
    if (precoTikTok !== null) {
      precoAtual = precoTikTok;
      confiancaPreco = 'alta';
    }
  }

  if (plataforma === 'mercado_livre') {
    var ml = extrairDadosMercadoLivre_(html);
    if (ml.titulo) titulo = ml.titulo;
    if (ml.precoAtual !== null) {
      precoAtual = ml.precoAtual;
      confiancaPreco = 'alta';
    }
    if (precoAtual !== null && ml.precoOriginal !== null && ml.precoOriginal > precoAtual) {
      precoOriginal = ml.precoOriginal;
    }
    if (ml.moeda) moeda = ml.moeda;
    if (ml.imagemUrl) imagemUrl = ml.imagemUrl;
  }

  // 1. JSON-LD (@type: Product)
  var produtoJsonLd = extrairJsonLdProduto_(html);
  if (produtoJsonLd) {
    if (!titulo && produtoJsonLd.name) titulo = limparTexto_(String(produtoJsonLd.name));
    if (!descricao && produtoJsonLd.description) {
      descricao = limparTexto_(String(produtoJsonLd.description));
    }
    if (!imagemUrl) imagemUrl = extrairImagemDeJsonLd_(produtoJsonLd.image);

    var oferta = extrairOfertaJsonLd_(produtoJsonLd.offers);
    if (oferta && oferta.preco !== null) {
      if (precoAtual === null) {
        precoAtual = oferta.preco;
        moeda = oferta.moeda || moeda;
        confiancaPreco = 'alta';
      }
      if (
        precoOriginal === null &&
        oferta.precoOriginal !== null &&
        oferta.precoOriginal > precoAtual
      ) {
        precoOriginal = oferta.precoOriginal;
      }
    }
  }

  // 2. Meta tags (og:*, product:price:*, twitter:*, itemprop="price")
  if (!titulo) {
    titulo =
      extrairMetaTag_(html, 'property', 'og:title') ||
      extrairMetaTag_(html, 'name', 'twitter:title') ||
      extrairMetaTag_(html, 'name', 'title');
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
      extrairMetaTag_(html, 'name', 'twitter:image') ||
      extrairMetaTag_(html, 'name', 'image');
  }

  // Ignora og:title genérico de captcha/hub do TikTok quando já temos og_info
  if (
    plataforma === 'tiktok_shop' &&
    (titulo === 'TikTok Shop' || titulo === 'Security Check')
  ) {
    titulo = '';
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

  // 3. Fallback de preço em texto (ex.: "De R$ 5.399 por R$ 4.199" ou "- R$ 4.199")
  if (precoAtual === null) {
    var ogTitleRaw = extrairMetaTag_(html, 'property', 'og:title');
    var daDescricao = extrairPrecosDeTextoBrl_(descricao);
    var doTitulo = extrairPrecosDeTextoBrl_(titulo);
    var doOgTitulo = extrairPrecosDeTextoBrl_(ogTitleRaw);

    var escolhido = null;
    if (daDescricao.precoAtual !== null && daDescricao.precoOriginal !== null) {
      escolhido = daDescricao;
    } else if (doTitulo.precoAtual !== null) {
      escolhido = doTitulo;
    } else if (doOgTitulo.precoAtual !== null) {
      escolhido = doOgTitulo;
    } else if (daDescricao.precoAtual !== null) {
      escolhido = daDescricao;
    }

    if (escolhido && escolhido.precoAtual !== null) {
      precoAtual = escolhido.precoAtual;
      if (precoOriginal === null && escolhido.precoOriginal !== null) {
        precoOriginal = escolhido.precoOriginal;
      }
      confiancaPreco = 'alta';
    }
  } else if (precoOriginal === null) {
    var origDaDescricao = extrairPrecosDeTextoBrl_(descricao);
    if (origDaDescricao.precoOriginal !== null && origDaDescricao.precoOriginal > precoAtual) {
      precoOriginal = origDaDescricao.precoOriginal;
    }
  }

  if (precoAtual === null || (precoOriginal !== null && precoOriginal <= precoAtual)) {
    precoOriginal = null;
  }

  // 4. Fallback de título: <title> (desde que não seja página de Security Check) ou slug da URL
  if (!titulo) {
    var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      var titleCandidato = limparTexto_(titleMatch[1]);
      var lowerTitle = titleCandidato.toLowerCase();
      if (
        lowerTitle !== 'security check' &&
        lowerTitle !== 'tiktok shop' &&
        lowerTitle !== 'just a moment...'
      ) {
        titulo = titleCandidato;
        avisos.push('Título extraído da tag <title>; verifique se precisa de ajuste.');
      }
    }
  }

  if (!titulo && urlFinal) {
    titulo = extrairTituloDoSlugUrl_(urlFinal, plataforma);
    if (titulo) {
      avisos.push('Título aproximado extraído do endereço do link; revise antes de salvar.');
    }
  }

  // Limpeza de sufixos/preços no título e descrição
  titulo = limparTituloMarketplace_(titulo, plataforma);
  if (plataforma === 'shopee') {
    descricao = limparDescricaoShopee_(descricao);
  }

  if (precoAtual === null) {
    confiancaPreco = 'nao_encontrado';
    if (plataforma === 'shopee' || plataforma === 'tiktok_shop') {
      avisos.push(
        'A loja não exibe o preço na leitura automática; preencha o valor atual manualmente.'
      );
    } else {
      avisos.push('Não foi possível identificar o preço automaticamente.');
    }
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

function extrairDadosMercadoLivre_(html) {
  var res = {
    titulo: '',
    precoAtual: null,
    precoOriginal: null,
    moeda: 'BRL',
    imagemUrl: '',
  };
  if (!html) return res;

  // JSON de componentes (/social/... e /p/MLB...) independente da ordem das chaves
  var curBlockMatch = html.match(
    /"current_price"\s*:\s*\{([^}]{0,260}"value"\s*:\s*"?\d+(?:[.,]\d+)*"?[^}]{0,260})\}/i
  );
  if (curBlockMatch && curBlockMatch[1]) {
    var blocoCur = curBlockMatch[1];
    var valMatch = blocoCur.match(/"value"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
    var curCurrencyMatch = blocoCur.match(/"currency"\s*:\s*"([A-Z]{3})"/i);
    var cur = valMatch && valMatch[1] ? normalizarNumeroPreco_(valMatch[1]) : null;
    if (cur !== null) {
      res.precoAtual = cur;
      if (curCurrencyMatch && curCurrencyMatch[1]) {
        res.moeda = curCurrencyMatch[1].toUpperCase();
      }
    }

    // Busca preço anterior apenas na janela próxima do componente de preço principal
    var idxCur = curBlockMatch.index || 0;
    var janela = html.slice(Math.max(0, idxCur - 400), idxCur + 600);
    var prevBlockMatch = janela.match(
      /"previous_price"\s*:\s*\{([^}]{0,260}"value"\s*:\s*"?\d+(?:[.,]\d+)*"?[^}]{0,260})\}/i
    );
    if (prevBlockMatch && prevBlockMatch[1]) {
      var prevValMatch = prevBlockMatch[1].match(/"value"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
      var prev = prevValMatch && prevValMatch[1] ? normalizarNumeroPreco_(prevValMatch[1]) : null;
      if (res.precoAtual !== null && prev !== null && prev > res.precoAtual) {
        res.precoOriginal = prev;
      }
    }
    if (res.precoOriginal === null) {
      var origInlineMatch = janela.match(
        /"(?:original_price|regular_amount|original_value|previous_price)"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i
      );
      var origVal = origInlineMatch && origInlineMatch[1] ? normalizarNumeroPreco_(origInlineMatch[1]) : null;
      if (res.precoAtual !== null && origVal !== null && origVal > res.precoAtual) {
        res.precoOriginal = origVal;
      }
    }
  } else {
    var priceObjMatch = html.match(
      /"price"\s*:\s*\{([^}]{0,260}"amount"\s*:\s*"?\d+(?:[.,]\d+)*"?[^}]{0,260})\}/i
    );
    if (priceObjMatch && priceObjMatch[1]) {
      var amountMatch = priceObjMatch[1].match(/"amount"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
      var regMatch = priceObjMatch[1].match(
        /"(?:regular_amount|original_price|original_value)"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i
      );
      var curAmount = amountMatch && amountMatch[1] ? normalizarNumeroPreco_(amountMatch[1]) : null;
      if (curAmount !== null) {
        res.precoAtual = curAmount;
        var regVal = regMatch && regMatch[1] ? normalizarNumeroPreco_(regMatch[1]) : null;
        if (regVal !== null && regVal > curAmount) {
          res.precoOriginal = regVal;
        }
      }
    }
  }

  var titleJsonMatch = html.match(/"type"\s*:\s*"title"[\s\S]{0,120}?"text"\s*:\s*"([^"]{3,240})"/i);
  if (titleJsonMatch && titleJsonMatch[1]) {
    res.titulo = limparTexto_(unescapeJsonBasico_(titleJsonMatch[1]));
  }

  // Fallback para páginas padrão de produto ML (state JSON / schema)
  if (res.precoAtual === null) {
    var tracksMatch = html.match(/"tracks"\s*:\s*\{\s*"price"\s*:[\s\S]{0,250}?"price"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i);
    if (tracksMatch && tracksMatch[1]) {
      res.precoAtual = normalizarNumeroPreco_(tracksMatch[1]);
      if (res.precoAtual !== null && res.precoOriginal === null && typeof tracksMatch.index === 'number') {
        var janelaTracks = html.slice(
          Math.max(0, tracksMatch.index - 200),
          tracksMatch.index + 500
        );
        var origTracksMatch = janelaTracks.match(
          /"(?:original_price|regular_amount|previous_price)"\s*:\s*"?(\d+(?:[.,]\d+)*)"?/i
        );
        var origTracks =
          origTracksMatch && origTracksMatch[1] ? normalizarNumeroPreco_(origTracksMatch[1]) : null;
        if (origTracks !== null && origTracks > res.precoAtual) {
          res.precoOriginal = origTracks;
        }
      }
    }
  }

  return res;
}

function extrairOgInfoDeUrls_(urls) {
  var res = { titulo: '', imagemUrl: '' };
  for (var i = urls.length - 1; i >= 0; i--) {
    var u = String(urls[i] || '');
    var match = u.match(/[?&]og_info=([^&#]+)/i);
    if (!match || !match[1]) continue;
    try {
      var decoded = decodeURIComponent(match[1]);
      var obj = JSON.parse(decoded);
      if (obj && typeof obj === 'object') {
        if (!res.titulo && obj.title) {
          res.titulo = limparTexto_(String(obj.title).replace(/\+/g, ' '));
        }
        if (!res.imagemUrl && obj.image) {
          res.imagemUrl = String(obj.image).trim();
        }
      }
    } catch (e) {
      // Ignora parâmetro og_info malformado
    }
  }
  return res;
}

function extrairPrecoJsonEmbutido_(html, chaves) {
  if (!html) return null;
  for (var i = 0; i < chaves.length; i++) {
    var regex = new RegExp('"' + chaves[i] + '"\\s*:\\s*"?(\\d+(?:[.,]\\d+)*)"?', 'i');
    var m = html.match(regex);
    if (m && m[1]) {
      var num = normalizarNumeroPreco_(m[1]);
      if (num !== null && num > 0) return num;
    }
  }
  return null;
}

function extrairPrecosDeTextoBrl_(texto) {
  if (!texto) return { precoAtual: null, precoOriginal: null };
  var str = String(texto);
  var regex = /R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
  var candidatos = [];

  var match;
  while ((match = regex.exec(str)) !== null) {
    var rawNum = match[1];
    if (!rawNum) continue;
    var valor = normalizarNumeroPreco_(rawNum);
    if (valor === null) continue;

    var inicio = match.index;
    var contextoAntes = str.slice(Math.max(0, inicio - 40), inicio);

    // Ignora parcelas (ex.: "12x de R$ 349,90", "10x R$ 419,90")
    if (
      /(?:\d+\s*x\s*(?:de\s*)?|parcelas?\s*(?:de\s*)?|em\s+at[eé]\s+\d+\s*x\s*(?:de\s*)?)$/i.test(
        contextoAntes
      )
    ) {
      continue;
    }

    // Ignora thresholds de frete, descontos absolutos, cupons e cashback
    if (
      /(?:acima\s+de|compras\s+(?:de|acima|a\s+partir\s+de)|pedidos\s+(?:de|acima|a\s+partir\s+de)|frete\s+gr[aá]tis[^\n]{0,25}|economize(?:\s+at[eé])?|desconto\s+de|off\s+de|(?:cupom|cashback|b[oô]nus|vale|entrada|juros)\s*(?:de\s*)?)\s*$/i.test(
        contextoAntes
      )
    ) {
      continue;
    }

    var papel = 'neutro';
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
      valor: valor,
      index: inicio,
      endIndex: inicio + match[0].length,
      papel: papel,
    });
  }

  if (candidatos.length === 0) {
    return { precoAtual: null, precoOriginal: null };
  }

  var explicitAtual = null;
  var explicitOriginal = null;
  for (var i = 0; i < candidatos.length; i++) {
    if (!explicitAtual && candidatos[i].papel === 'atual') explicitAtual = candidatos[i];
    if (!explicitOriginal && candidatos[i].papel === 'original') explicitOriginal = candidatos[i];
  }

  if (explicitAtual && explicitOriginal) {
    return {
      precoAtual: explicitAtual.valor,
      precoOriginal: explicitOriginal.valor > explicitAtual.valor ? explicitOriginal.valor : null,
    };
  }

  if (explicitAtual) {
    var outroMaior = null;
    for (var j = 0; j < candidatos.length; j++) {
      if (candidatos[j] !== explicitAtual && candidatos[j].valor > explicitAtual.valor) {
        outroMaior = candidatos[j];
        break;
      }
    }
    return {
      precoAtual: explicitAtual.valor,
      precoOriginal: outroMaior ? outroMaior.valor : null,
    };
  }

  if (explicitOriginal) {
    var outroMenor = null;
    for (var k = 0; k < candidatos.length; k++) {
      if (candidatos[k] !== explicitOriginal && candidatos[k].valor < explicitOriginal.valor) {
        outroMenor = candidatos[k];
        break;
      }
    }
    if (outroMenor) {
      return { precoAtual: outroMenor.valor, precoOriginal: explicitOriginal.valor };
    }
    return { precoAtual: null, precoOriginal: null };
  }

  if (candidatos.length >= 2) {
    var primeiro = candidatos[0];
    var segundo = candidatos[1];
    if (segundo.index - primeiro.endIndex <= 45 && primeiro.valor !== segundo.valor) {
      var maior = Math.max(primeiro.valor, segundo.valor);
      var menor = Math.min(primeiro.valor, segundo.valor);
      if (maior <= menor * 5) {
        return { precoAtual: menor, precoOriginal: maior };
      }
    }
  }

  return { precoAtual: candidatos[0].valor, precoOriginal: null };
}

function extrairPrecoDeTextoBrl_(texto) {
  return extrairPrecosDeTextoBrl_(texto).precoAtual;
}

function extrairTituloDoSlugUrl_(url, plataforma) {
  try {
    var semQuery = url.replace(/[?#].*$/, '');
    if (plataforma === 'shopee') {
      var mShopee = semQuery.match(/shopee\.com(?:\.br)?\/([^\/]+)-i\.\d+\.\d+/i);
      if (mShopee && mShopee[1]) {
        return limparTexto_(decodeURIComponent(mShopee[1]).replace(/[-+]+/g, ' '));
      }
    }
    var partes = semQuery.split('/').filter(Boolean);
    var ultimo = partes.length > 0 ? partes[partes.length - 1] : '';
    if (ultimo && ultimo.length > 8 && !/^MLB\d+$/i.test(ultimo)) {
      return limparTexto_(decodeURIComponent(ultimo).replace(/[-_+]+/g, ' '));
    }
  } catch (e) {
    // Ignora URL malformada
  }
  return '';
}

function limparTituloMarketplace_(titulo, plataforma) {
  if (!titulo) return '';
  var t = String(titulo).trim();
  t = t.replace(/\s*[-–|]\s*R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*$/i, '');
  if (plataforma === 'shopee') {
    t = t.replace(/\s*\|\s*Shopee(?:\s+Brasil)?\s*$/i, '');
  } else if (plataforma === 'mercado_livre') {
    t = t.replace(/\s*\|\s*Mercado\s*Livre(?:\s+Brasil)?\s*$/i, '');
  } else if (plataforma === 'amazon') {
    t = t.replace(/\s*:\s*Amazon\.com(?:\.br)?\s*$/i, '').replace(/\s*\|\s*Amazon(?:\.com\.br)?\s*$/i, '');
  } else if (plataforma === 'magalu') {
    t = t.replace(/\s*[-|]\s*Magazine\s*Luiza\s*$/i, '').replace(/\s*\|\s*Magalu\s*$/i, '');
  } else if (plataforma === 'kabum') {
    t = t.replace(/\s*\|\s*KaBuM!\s*$/i, '');
  }
  return t.trim();
}

function limparDescricaoShopee_(descricao) {
  if (!descricao) return '';
  var d = String(descricao).trim();
  d = d.replace(/^Compre\s+[\s\S]{3,220}?\s+na\s+Shopee\s+Brasil!\s*/i, '');
  return d.trim();
}

function unescapeJsonBasico_(str) {
  return String(str)
    .replace(/\\u002F/gi, '/')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\');
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
    if (tipo === 'Product' || (Array.isArray(tipo) && tipo.indexOf('Product') !== -1)) {
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
    var highNum = o.highPrice !== undefined ? normalizarNumeroPreco_(o.highPrice) : null;

    if ((highNum === null || (num !== null && highNum <= num)) && o.priceSpecification) {
      var specs = Array.isArray(o.priceSpecification) ? o.priceSpecification : [o.priceSpecification];
      for (var s = 0; s < specs.length; s++) {
        var sp = specs[s];
        if (!sp || typeof sp !== 'object') continue;
        var pType = String(sp.priceType || '');
        if (/ListPrice|StrikethroughPrice/i.test(pType)) {
          var candOrig = normalizarNumeroPreco_(sp.price);
          if (candOrig !== null && (num === null || candOrig > num)) {
            highNum = candOrig;
            break;
          }
        }
      }
    }

    if (num !== null && num > 0) {
      return {
        preco: num,
        precoOriginal: highNum && highNum > num ? highNum : null,
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
  var padroes = [
    '<meta[^>]*\\b' + attrName + '=["\']' + escaped + '["\'][^>]*\\bcontent="([^"]*)"[^>]*>',
    '<meta[^>]*\\b' + attrName + '=["\']' + escaped + '["\'][^>]*\\bcontent=\'([^\']*)\'[^>]*>',
    '<meta[^>]*\\bcontent="([^"]*)"[^>]*\\b' + attrName + '=["\']' + escaped + '["\'][^>]*>',
    '<meta[^>]*\\bcontent=\'([^\']*)\'[^>]*\\b' + attrName + '=["\']' + escaped + '["\'][^>]*>',
  ];
  for (var i = 0; i < padroes.length; i++) {
    var m = html.match(new RegExp(padroes[i], 'i'));
    if (m && m[1]) return limparTexto_(m[1]);
  }
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
  var str = String(valor).trim().replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!str) return null;

  if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.indexOf(',') !== -1) {
    var partesVirgula = str.split(',');
    str = partesVirgula.length > 2 ? partesVirgula.join('') : str.replace(',', '.');
  } else if (str.indexOf('.') !== -1) {
    if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    } else if (str.split('.').length > 2) {
      return null;
    }
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
