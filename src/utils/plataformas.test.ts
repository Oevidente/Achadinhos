import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarPlataforma, PLATAFORMAS_CONFIG } from './plataformas';

test('detectarPlataforma identifica marketplaces e subdomínios conhecidos', () => {
  assert.equal(detectarPlataforma('https://shopee.com.br/produto-teste-i.123.456'), 'shopee');
  assert.equal(detectarPlataforma('https://s.shopee.com.br/9A8B7C'), 'shopee');
  assert.equal(detectarPlataforma('https://www.mercadolivre.com.br/fone-bluetooth/p/MLB123'), 'mercado_livre');
  assert.equal(detectarPlataforma('https://mercadolibre.com/item'), 'mercado_livre');
  assert.equal(detectarPlataforma('https://www.amazon.com.br/dp/B09V3KXJPB'), 'amazon');
  assert.equal(detectarPlataforma('https://amzn.to/3XYZabc'), 'amazon');
  assert.equal(detectarPlataforma('https://www.tiktok.com/@loja/video/123'), 'tiktok_shop');
  assert.equal(detectarPlataforma('https://vm.tiktok.com/ZM8abc123/'), 'tiktok_shop');
  assert.equal(detectarPlataforma('https://www.magazineluiza.com.br/produto/p/123'), 'magalu');
  assert.equal(detectarPlataforma('https://magalu.com/oferta'), 'magalu');
  assert.equal(detectarPlataforma('https://pt.aliexpress.com/item/100500.html'), 'aliexpress');
  assert.equal(detectarPlataforma('https://www.americanas.com.br/produto/123'), 'americanas');
  assert.equal(detectarPlataforma('https://www.kabum.com.br/produto/999'), 'kabum');
});

test('detectarPlataforma funciona sem esquema http/https e com espaços', () => {
  assert.equal(detectarPlataforma('  s.shopee.com.br/oferta  '), 'shopee');
  assert.equal(detectarPlataforma('AMZN.TO/teste'), 'amazon');
});

test('detectarPlataforma retorna outra para domínios desconhecidos ou inválidos', () => {
  assert.equal(detectarPlataforma('https://lojaminha.exemplo.com/produto'), 'outra');
  assert.equal(detectarPlataforma(''), 'outra');
  assert.equal(detectarPlataforma('texto-sem-dominio'), 'outra');
});

test('PLATAFORMAS_CONFIG possui nome e corSelo válidos para todas as plataformas', () => {
  for (const config of Object.values(PLATAFORMAS_CONFIG)) {
    assert.ok(config.nome.length > 0);
    assert.match(config.corSelo, /^#[0-9A-Fa-f]{6}$/);
  }
});
