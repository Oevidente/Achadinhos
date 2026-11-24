import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairMetadadosDeHtml,
  extrairMetadadosPelaUrlLocal,
  formatarPrecoParaInput,
  isDominioPermitidoExtrator,
  montarUrlRequisicaoExtrator,
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
  assert.equal(isDominioPermitidoExtrator('https://s.shopee.com.br/oferta'), true);
  assert.equal(isDominioPermitidoExtrator('https://vt.tiktok.com/ZS9P5NFGcubRK-81k11/'), true);

  assert.equal(isDominioPermitidoExtrator('http://www.mercadolivre.com.br/produto'), false);
  assert.equal(isDominioPermitidoExtrator('https://site-aleatorio.exemplo.com/produto'), false);
  assert.equal(isDominioPermitidoExtrator('https://localhost/admin'), false);
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
});

test('formatarPrecoParaInput formata preço para vírgula brasileira', () => {
  assert.equal(formatarPrecoParaInput(199.9), '199,90');
  assert.equal(formatarPrecoParaInput(null), '');
  assert.equal(formatarPrecoParaInput(0), '');
});
