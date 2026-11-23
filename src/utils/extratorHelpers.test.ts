import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatarPrecoParaInput,
  isDominioPermitidoExtrator,
  montarUrlRequisicaoExtrator,
  normalizarRespostaExtrator,
} from './extratorHelpers';

test('isDominioPermitidoExtrator aceita marketplaces conhecidos e recusa outros domínios', () => {
  assert.equal(isDominioPermitidoExtrator('https://www.mercadolivre.com.br/produto-p/MLB123'), true);
  assert.equal(isDominioPermitidoExtrator('https://amzn.to/3XYZabc'), true);
  assert.equal(isDominioPermitidoExtrator('https://s.shopee.com.br/oferta'), true);
  assert.equal(isDominioPermitidoExtrator('https://vm.tiktok.com/ZM8abc/'), true);

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
      titulo: 'Monitor Gamer 27"',
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

test('formatarPrecoParaInput formata preço para vírgula brasileira', () => {
  assert.equal(formatarPrecoParaInput(199.9), '199,90');
  assert.equal(formatarPrecoParaInput(null), '');
  assert.equal(formatarPrecoParaInput(0), '');
});
