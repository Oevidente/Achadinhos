import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairMetadadosDeHtml,
  extrairMetadadosPelaUrlLocal,
  extrairPrecosDeTextoBrl,
  formatarPrecoParaInput,
  isDominioPermitidoExtrator,
  montarUrlRequisicaoExtrator,
  normalizarNumeroPreco,
  normalizarRespostaExtrator,
} from './extratorHelpers';

test('isDominioPermitidoExtrator aceita marketplaces conhecidos e recusa outros domínios', () => {
  assert.equal(isDominioPermitidoExtrator('https://www.mercadolivre.com.br/produto-p/MLB123'), true);
  assert.equal(
    isDominioPermitidoExtrator(
      'https://www.mercadolivre.com.br/social/andreluiz1902?matt_word=andreluiz1902#origin=copy_link'
    ),
    true
  );
  assert.equal(isDominioPermitidoExtrator('https://amzn.to/3XYZabc'), true);
  assert.equal(isDominioPermitidoExtrator('https://link.amazon/B0c64ySiV'), true);
  assert.equal(isDominioPermitidoExtrator('https://amzlinks.in/B0c64ySiV'), true);
  assert.equal(isDominioPermitidoExtrator('https://a.co/d/9xYz123'), true);
  assert.equal(isDominioPermitidoExtrator('https://amzn.eu/d/9xYz123'), true);
  assert.equal(isDominioPermitidoExtrator('https://www.amazon.com.br/Echo-Dot-5a-geracao/dp/B09B8VGCR8'), true);
  assert.equal(isDominioPermitidoExtrator('https://s.shopee.com.br/oferta'), true);
  assert.equal(isDominioPermitidoExtrator('https://vt.tiktok.com/ZS9P5NFGcubRK-81k11/'), true);

  assert.equal(isDominioPermitidoExtrator('http://www.mercadolivre.com.br/produto'), false);
  assert.equal(isDominioPermitidoExtrator('https://site-aleatorio.exemplo.com/produto'), false);
  assert.equal(isDominioPermitidoExtrator('https://localhost/admin'), false);

  const amazonSlug = extrairMetadadosPelaUrlLocal(
    'https://www.amazon.com.br/Echo-Dot-5a-geracao/dp/B09B8VGCR8'
  );
  assert.ok(amazonSlug);
  assert.equal(amazonSlug.plataforma, 'amazon');
  assert.equal(amazonSlug.titulo, 'Echo Dot 5a geracao');
});

test('montarUrlRequisicaoExtrator codifica url e token como query params', () => {
  const final = montarUrlRequisicaoExtrator(
    'https://script.google.com/macros/s/AKfycb123/exec',
    'segredo-123',
    'https://www.mercadolivre.com.br/oferta?ref=1'
  );
  const parsed = new URL(final);
  assert.equal(parsed.searchParams.get('token'), 'segredo-123');
  assert.equal(parsed.searchParams.get('url'), 'https://www.mercadolivre.com.br/oferta?ref=1');
});

test('normalizarRespostaExtrator processa sucesso e rejeita falhas tratadas', () => {
  const sucesso = normalizarRespostaExtrator(
    {
      ok: true,
      plataforma: 'mercado_livre',
      titulo: 'Monitor Gamer 27" | Mercado Livre',
      descricao: '144Hz IPS',
      imagemUrl: 'https://http2.mlstatic.com/img.jpg',
      precoAtual: 1199.9,
      precoOriginal: 1499.9,
      moeda: 'BRL',
      confiancaPreco: 'alta',
      avisos: [],
    },
    'https://www.mercadolivre.com.br/monitor'
  );

  assert.equal(sucesso.plataforma, 'mercado_livre');
  assert.equal(sucesso.titulo, 'Monitor Gamer 27"');
  assert.equal(sucesso.precoAtual, 1199.9);
  assert.equal(sucesso.confiancaPreco, 'alta');

  assert.throws(
    () =>
      normalizarRespostaExtrator(
        {
          ok: false,
          erro: 'A loja exibiu verificação anti-robô (captcha).',
        },
        'https://www.amazon.com.br/dp/123'
      ),
    /captcha/
  );
});

test('extrairMetadadosDeHtml extrai preço atual, anterior, título e foto de link /social/ do Mercado Livre', () => {
  const urlMl =
    'https://www.mercadolivre.com.br/social/andreluiz1902?matt_word=andreluiz1902&matt_tool=30915636#origin=copy_link';
  const htmlMl = `
    <html><head>
      <meta property="og:title" content="Controle Joystick Sem Fio Sony Playstation 5 Midnight Black Preto - R$ 371,07">
      <meta property="og:image" content="https://http2.mlstatic.com/D_Q_NP_2X_999.jpg">
      <meta property="og:description" content="Oferta imperdível no Mercado Livre.">
    </head><body>
      <script>window.__PRELOADED_STATE__ = {"components":[{"type":"title","text":"Controle Joystick Sem Fio Sony Playstation 5 Midnight Black Preto"},{"type":"price","current_price":{"value":371.07,"currency":"BRL"},"previous_price":{"value":499.9,"currency":"BRL"}}]};</script>
    </body></html>
  `;

  const res = extrairMetadadosDeHtml(htmlMl, urlMl);
  assert.ok(res);
  assert.equal(res.plataforma, 'mercado_livre');
  assert.equal(res.titulo, 'Controle Joystick Sem Fio Sony Playstation 5 Midnight Black Preto');
  assert.equal(res.precoAtual, 371.07);
  assert.equal(res.precoOriginal, 499.9);
  assert.equal(res.imagemUrl, 'https://http2.mlstatic.com/D_Q_NP_2X_999.jpg');
  assert.equal(res.confiancaPreco, 'alta');
});

test('extrairMetadadosDeHtml lida com apóstrofos no og:description da Shopee e limpa sufixos', () => {
  const urlShopee =
    'https://shopee.com.br/Lumin%C3%A1ria-Ma%C3%A7o-de-10kUSD-d%C3%B3lar-inspirado-no-GTA-VI-Roda-apoiado-com-LED-USB-presente-GTA-RP-Setup-Gamer-i.1183062168.58214190303?extraParams=%7B%22display_model_id%22%3A199624167662%7D';
  const htmlShopee = `
    <html><head>
      <meta data-rh="true" property="og:title" content="Luminária Maço de 10kUSD dólar inspirado no GTA VI Roda apoiado com LED USB presente GTA RP Setup Gamer | Shopee Brasil">
      <meta data-rh="true" property="og:description" content="Compre Luminária Maço de 10kUSD na Shopee Brasil! LED USB ideal pra gamer's setup e presente criativo.">
      <meta data-rh="true" property="og:image" content="https://down-br.img.susercontent.com/file/br-11134207-abc.jpg">
    </head></html>
  `;

  const res = extrairMetadadosDeHtml(htmlShopee, urlShopee);
  assert.ok(res);
  assert.equal(res.plataforma, 'shopee');
  assert.equal(
    res.titulo,
    'Luminária Maço de 10kUSD dólar inspirado no GTA VI Roda apoiado com LED USB presente GTA RP Setup Gamer'
  );
  assert.equal(res.descricao, "LED USB ideal pra gamer's setup e presente criativo.");
  assert.equal(res.imagemUrl, 'https://down-br.img.susercontent.com/file/br-11134207-abc.jpg');
  assert.equal(res.precoAtual, null);
});

test('extrairMetadadosPelaUrlLocal extrai título de slug Shopee mesmo sem servidor', () => {
  const urlShopee =
    'https://shopee.com.br/Lumin%C3%A1ria-Ma%C3%A7o-de-10kUSD-d%C3%B3lar-inspirado-no-GTA-VI-Roda-apoiado-com-LED-USB-presente-GTA-RP-Setup-Gamer-i.1183062168.58214190303';
  const res = extrairMetadadosPelaUrlLocal(urlShopee);
  assert.ok(res);
  assert.equal(res.plataforma, 'shopee');
  assert.match(res.titulo, /Luminária Maço de 10kUSD dólar inspirado no GTA VI/);
});

test('extrairMetadadosDeHtml recupera título e imagem do og_info do TikTok Shop mesmo com Security Check', () => {
  const urlCurta = 'https://vt.tiktok.com/ZS9P5NFGcubRK-81k11/';
  const urlRedirecionada =
    'https://www.tiktok.com/view/product/172959220001?og_info=%7B%22title%22%3A%22Kit+Microfone+Lapela+Sem+Fio%22%2C%22image%22%3A%22https%3A%2F%2Fp16-oec-sg.ibyteimg.com%2Ffoto.jpeg%22%7D';
  const htmlCaptcha = `
    <html><head>
      <title>Security Check</title>
      <meta property="og:title" content="TikTok Shop">
    </head><body>Drag the puzzle piece</body></html>
  `;

  const res = extrairMetadadosDeHtml(htmlCaptcha, urlCurta, [urlCurta, urlRedirecionada]);
  assert.ok(res);
  assert.equal(res.plataforma, 'tiktok_shop');
  assert.equal(res.titulo, 'Kit Microfone Lapela Sem Fio');
  assert.equal(res.imagemUrl, 'https://p16-oec-sg.ibyteimg.com/foto.jpeg');
  assert.equal(res.precoAtual, null);
});

test('Google Apps Script (apps-script/Code.gs) extrai Shopee, Mercado Livre e TikTok Shop corretamente', () => {
  const code = fs.readFileSync(path.resolve(process.cwd(), 'apps-script/Code.gs'), 'utf8');
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(code, context);

  const detectarPlataformaFinal = context.detectarPlataformaFinal_ as (
    urls: string[],
    html: string,
    fallback: string
  ) => string;
  const extrairMetadadosProduto = context.extrairMetadadosProduto_ as (
    html: string,
    plataforma: string,
    urls: string[]
  ) => {
    titulo: string;
    descricao: string;
    imagemUrl: string;
    precoAtual: number | null;
    precoOriginal: number | null;
    confiancaPreco: string;
  };

  // Mercado Livre /social/
  const mlRes = extrairMetadadosProduto(
    `<meta property="og:title" content="Controle PS5 - R$ 371,07"><meta property="og:image" content="https://http2.mlstatic.com/ps5.jpg"><script>{"type":"title","text":"Controle Joystick Sem Fio PS5","current_price":{"value":371.07,"currency":"BRL"},"previous_price":{"value":499.9}}</script>`,
    'mercado_livre',
    ['https://www.mercadolivre.com.br/social/andreluiz1902']
  );
  assert.equal(mlRes.titulo, 'Controle Joystick Sem Fio PS5');
  assert.equal(mlRes.precoAtual, 371.07);
  assert.equal(mlRes.precoOriginal, 499.9);
  assert.equal(mlRes.confiancaPreco, 'alta');

  // Shopee com apóstrofo
  const shopeeRes = extrairMetadadosProduto(
    `<meta data-rh="true" property="og:title" content="Luminária Maço 10k | Shopee Brasil"><meta data-rh="true" property="og:description" content="Compre Luminária Maço 10k na Shopee Brasil! It's awesome."><meta data-rh="true" property="og:image" content="https://down-br.img.susercontent.com/img.jpg">`,
    'shopee',
    ['https://shopee.com.br/Luminaria-i.1.2']
  );
  assert.equal(shopeeRes.titulo, 'Luminária Maço 10k');
  assert.equal(shopeeRes.descricao, "It's awesome.");
  assert.equal(shopeeRes.imagemUrl, 'https://down-br.img.susercontent.com/img.jpg');

  // TikTok Shop via og_info + Security Check
  const ttUrls = [
    'https://vt.tiktok.com/ZS9P5NFGcubRK-81k11/',
    'https://www.tiktok.com/view/product/123?og_info=%7B%22title%22%3A%22Fone+Bluetooth+Mini%22%2C%22image%22%3A%22https%3A%2F%2Fp16.tiktokcdn.com%2Fimg.jpg%22%7D',
  ];
  assert.equal(detectarPlataformaFinal(ttUrls, '', 'tiktok_shop'), 'tiktok_shop');
  const ttRes = extrairMetadadosProduto('<title>Security Check</title>', 'tiktok_shop', ttUrls);
  assert.equal(ttRes.titulo, 'Fone Bluetooth Mini');
  assert.equal(ttRes.imagemUrl, 'https://p16.tiktokcdn.com/img.jpg');
  assert.equal(ttRes.precoAtual, null);
  // Mercado Livre /social/ com chaves invertidas, valores altos e carrossel distante
  const mlAltoRes = extrairMetadadosProduto(
    `<meta property="og:title" content="Notebook Gamer - R$ 4.199"><meta property="og:image" content="https://http2.mlstatic.com/note.jpg"><script>{"type":"title","text":"Notebook Gamer RTX","current_price":{"currency":"BRL","value":4199},"previous_price":{"currency":"BRL","value":5399}}</script>${'x'.repeat(900)}<script>{"previous_price":{"value":9999}}</script>`,
    'mercado_livre',
    ['https://www.mercadolivre.com.br/social/andreluiz1902']
  );
  assert.equal(mlAltoRes.precoAtual, 4199);
  assert.equal(mlAltoRes.precoOriginal, 5399);

  // Texto BRL em descrição: "De R$ 5.399 por R$ 4.199 (12x de R$ 349,90)" e JSON-LD ListPrice
  const brlTextoRes = extrairMetadadosProduto(
    `<meta property="og:title" content="Smart TV 65 4K"><meta property="og:description" content="De R$ 5.399 por apenas R$ 4.199 em até 12x de R$ 349,90. Cupom de R$ 100.">`,
    'shopee',
    ['https://shopee.com.br/Smart-TV-i.1.2']
  );
  assert.equal(brlTextoRes.precoAtual, 4199);
  assert.equal(brlTextoRes.precoOriginal, 5399);

  // Nunca confunde "De R$ 5.399" isolado com preço atual
  const deIsoladoRes = extrairMetadadosProduto(
    `<meta property="og:title" content="Console X"><meta property="og:description" content="De R$ 5.399 com entrega rápida">`,
    'shopee',
    ['https://shopee.com.br/Console-i.1.2']
  );
  assert.equal(deIsoladoRes.precoAtual, null);
  assert.equal(deIsoladoRes.precoOriginal, null);

  // JSON-LD com priceSpecification ListPrice
  const jsonLdRes = extrairMetadadosProduto(
    `<script type="application/ld+json">{"@type":"Product","name":"Geladeira Frost Free","offers":{"@type":"Offer","price":4199,"priceCurrency":"BRL","priceSpecification":[{"@type":"UnitPriceSpecification","priceType":"https://schema.org/ListPrice","price":5499}]}}</script>`,
    'kabum',
    ['https://www.kabum.com.br/produto/123']
  );
  assert.equal(jsonLdRes.precoAtual, 4199);
  assert.equal(jsonLdRes.precoOriginal, 5499);

  // Amazon HTML real: productTitle, landingImage HD, priceAmount + basisPrice + entidades + link.amazon/amzlinks.in
  const extrairRedirecionamentoHtml = context.extrairRedirecionamentoHtml_ as (
    html: string,
    baseUrl: string
  ) => string;
  assert.equal(
    detectarPlataformaFinal(['https://link.amazon/B0c64ySiV'], '', 'amazon'),
    'amazon'
  );
  assert.equal(
    extrairRedirecionamentoHtml(
      `<base href="https://r.amzlinks.in?btn_ref=1&amp;btn_url=https%3A%2F%2Fwww.amazon.com.br%2Fdp%2FB0CH8R3HSR%3Ftag%3Dabc">`,
      'https://amzlinks.in/B0c64ySiV'
    ),
    'https://www.amazon.com.br/dp/B0CH8R3HSR?tag=abc'
  );
  const amzCodeGsRes = extrairMetadadosProduto(
    `<span id="productTitle">Jogo de Frigideiras Alum&iacute;nio 03 Pe&ccedil;as</span><img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/912-0XnKf-L._AC_SL1500_.jpg"><div class="twister-plus-buying-options-price-data">{"desktop_buybox_group_1":[{"priceAmount":74.89}]}</div><span class="apex-basisprice-offscreen-label">De: R$ 115,09</span>`,
    'amazon',
    ['https://www.amazon.com.br/dp/B0CH8R3HSR']
  );
  assert.equal(amzCodeGsRes.titulo, 'Jogo de Frigideiras Alumínio 03 Peças');
  assert.equal(
    amzCodeGsRes.imagemUrl,
    'https://m.media-amazon.com/images/I/912-0XnKf-L._AC_SL1500_.jpg'
  );
  assert.equal(amzCodeGsRes.precoAtual, 74.89);
  assert.equal(amzCodeGsRes.precoOriginal, 115.09);
});

test('normalizarNumeroPreco e extrairPrecosDeTextoBrl não truncam valores altos como 4.199 ou 4.499', () => {
  assert.equal(normalizarNumeroPreco('4.199'), 4199);
  assert.equal(normalizarNumeroPreco('4.499'), 4499);
  assert.equal(normalizarNumeroPreco('12.499,90'), 12499.9);
  assert.equal(normalizarNumeroPreco('4199.9'), 4199.9);

  assert.deepEqual(extrairPrecosDeTextoBrl('Notebook - R$ 4.199'), {
    precoAtual: 4199,
    precoOriginal: null,
  });
  assert.deepEqual(extrairPrecosDeTextoBrl('TV 4K - R$ 4.499 em 10x de R$ 449,90'), {
    precoAtual: 4499,
    precoOriginal: null,
  });
  assert.deepEqual(extrairPrecosDeTextoBrl('De R$ 5.499 por apenas R$ 4.199 (12x de R$ 349,90)'), {
    precoAtual: 4199,
    precoOriginal: 5499,
  });
  assert.deepEqual(extrairPrecosDeTextoBrl('Oferta R$ 5.399 R$ 4.199'), {
    precoAtual: 4199,
    precoOriginal: 5399,
  });
  assert.deepEqual(extrairPrecosDeTextoBrl('De R$ 5.399'), {
    precoAtual: null,
    precoOriginal: null,
  });
});

test('extrairMetadadosDeHtml lida com current_price invertido, amount/regular_amount e carrossel distante no ML', () => {
  const htmlMl = `
    <html><head>
      <meta property="og:title" content="Notebook Pro - R$ 4.199">
      <meta property="og:image" content="https://http2.mlstatic.com/note.jpg">
    </head><body>
      <script>{"components":[{"type":"title","text":"Notebook Pro 16GB"},{"type":"price","current_price":{"currency":"BRL","value":4199},"previous_price":{"currency":"BRL","value":5399}}]}</script>
      ${'x'.repeat(900)}
      <script>{"previous_price":{"value":9999}}</script>
    </body></html>
  `;
  const res = extrairMetadadosDeHtml(htmlMl, 'https://www.mercadolivre.com.br/social/teste');
  assert.ok(res);
  assert.equal(res.precoAtual, 4199);
  assert.equal(res.precoOriginal, 5399);

  const htmlMlAmount = `
    <html><head>
      <meta property="og:title" content="Placa de Vídeo RTX">
      <meta property="og:image" content="https://http2.mlstatic.com/rtx.jpg">
    </head><body>
      <script>{"price":{"amount":4499,"regular_amount":5899}}</script>
    </body></html>
  `;
  const resAmount = extrairMetadadosDeHtml(
    htmlMlAmount,
    'https://www.mercadolivre.com.br/placa-p/MLB12345'
  );
  assert.ok(resAmount);
  assert.equal(resAmount.precoAtual, 4499);
  assert.equal(resAmount.precoOriginal, 5899);
});

test('formatarPrecoParaInput formata preço para vírgula brasileira', () => {
  assert.equal(formatarPrecoParaInput(199.9), '199,90');
  assert.equal(formatarPrecoParaInput(4199), '4199,00');
  assert.equal(formatarPrecoParaInput(null), '');
  assert.equal(formatarPrecoParaInput(0), '');
});

test('Google Apps Script doGet valida TOKEN_SECRETO, aceita PropertiesService e orienta se placeholder não foi trocado', () => {
  const code = fs.readFileSync(path.resolve(process.cwd(), 'apps-script/Code.gs'), 'utf8');

  function executarDoGet(
    params: Record<string, string>,
    scriptProps: Record<string, string> = {}
  ): { ok: boolean; erro?: string } {
    let saida = '';
    const context: Record<string, unknown> = {
      ContentService: {
        MimeType: { JSON: 'application/json' },
        createTextOutput: (txt: string) => ({
          setMimeType: () => {
            saida = txt;
            return txt;
          },
        }),
      },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (chave: string) => scriptProps[chave] ?? null,
          getProperties: () => ({ ...scriptProps }),
        }),
      },
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    const doGet = context.doGet as (e: { parameter: Record<string, string> }) => string;
    doGet({ parameter: params });
    return JSON.parse(saida) as { ok: boolean; erro?: string };
  }

  // Sem token configurado (placeholder ativo e sem PropertiesService)
  const semConfig = executarDoGet({ token: 'qualquer', url: 'https://www.amazon.com.br/dp/B0CH8R3HSR' });
  assert.equal(semConfig.ok, false);
  assert.match(semConfig.erro || '', /não configurado/i);
  assert.match(semConfig.erro || '', /nenhuma/i);

  // Com PropertiesService configurado: token vazio, divergente e com aspas dão mensagens precisas
  const tokenAusente = executarDoGet(
    { token: '', url: 'https://www.amazon.com.br/dp/B0CH8R3HSR' },
    { TOKEN_SECRETO: 'segredo-producao-123' }
  );
  assert.equal(tokenAusente.ok, false);
  assert.match(tokenAusente.erro || '', /ausente/i);

  const tokenErrado = executarDoGet(
    { token: '"segredo-producao-123"', url: 'https://www.amazon.com.br/dp/B0CH8R3HSR' },
    { TOKEN_SECRETO: 'segredo-producao-123' }
  );
  assert.equal(tokenErrado.ok, false);
  assert.match(tokenErrado.erro || '', /inválido/i);
  assert.match(tokenErrado.erro || '', /aspas/i);
  assert.match(tokenErrado.erro || '', /Propriedades do script/i);

  const tokenCertoPassaAuth = executarDoGet(
    { token: ' segredo-producao-123 ', url: 'https://site-fora.exemplo.com/produto' },
    { ' token_secreto ': ' segredo-producao-123 ' }
  );
  assert.equal(tokenCertoPassaAuth.ok, false);
  assert.match(tokenCertoPassaAuth.erro || '', /Domínio não permitido/i);

  const diagnosticoOk = executarDoGet(
    { action: 'diagnostico', token: 'segredo-producao-123' },
    { TOKEN_SECRETO: 'segredo-producao-123' }
  ) as { ok: boolean; versao?: string; tokenValido?: boolean };
  assert.equal(diagnosticoOk.ok, true);
  assert.equal(diagnosticoOk.tokenValido, true);
  assert.ok(diagnosticoOk.versao);
});

