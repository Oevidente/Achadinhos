import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUTO_LIMITES,
  sanitizarAtualizacaoProduto,
  sanitizarCriacaoProduto,
  validarIdDocumento,
} from './produtoValidation';

test('sanitizarCriacaoProduto preenche padrões e detecta plataforma pelo linkOriginal', () => {
  const sanitizado = sanitizarCriacaoProduto({
    titulo: '  Fone Bluetooth Pro  ',
    precoAtual: 149.9,
    linkOriginal: 'https://s.shopee.com.br/oferta123',
  });

  assert.equal(sanitizado.titulo, 'Fone Bluetooth Pro');
  assert.equal(sanitizado.descricao, '');
  assert.equal(sanitizado.imagemUrl, '');
  assert.equal(sanitizado.precoAtual, 149.9);
  assert.equal(sanitizado.precoOriginal, null);
  assert.equal(sanitizado.moeda, 'BRL');
  assert.equal(sanitizado.plataforma, 'shopee');
  assert.equal(sanitizado.linkAfiliado, null);
  assert.equal(sanitizado.status, 'ativo');
  assert.equal(sanitizado.origemDados, 'manual');
  assert.equal(sanitizado.destaque, false);
  assert.equal(sanitizado.cliques, 0);
  assert.equal(sanitizado.validoAte, null);
  assert.equal(sanitizado.cupom, null);
});

test('sanitizarCriacaoProduto aplica limites de tamanho e rejeita dados inválidos', () => {
  const tituloGigante = 'a'.repeat(300);
  const cupomGigante = '  ' + 'X'.repeat(80) + '  ';
  const sanitizado = sanitizarCriacaoProduto({
    titulo: tituloGigante,
    precoAtual: 10,
    linkOriginal: 'https://amzn.to/abc',
    validoAte: '2026-12-31',
    cupom: cupomGigante,
  });
  assert.equal(sanitizado.titulo.length, PRODUTO_LIMITES.TITULO_MAX);
  assert.equal(sanitizado.validoAte, '2026-12-31');
  assert.equal(sanitizado.cupom?.length, PRODUTO_LIMITES.CUPOM_MAX);

  assert.throws(() =>
    sanitizarCriacaoProduto({
      titulo: '   ',
      precoAtual: 10,
      linkOriginal: 'https://amzn.to/abc',
    })
  );

  assert.throws(() =>
    sanitizarCriacaoProduto({
      titulo: 'Item',
      precoAtual: -5,
      linkOriginal: 'https://amzn.to/abc',
    })
  );

  assert.throws(() =>
    sanitizarCriacaoProduto({
      titulo: 'Item',
      precoAtual: 10,
      linkOriginal: 'https://amzn.to/abc',
      validoAte: '31/12/2026',
    })
  );
});

test('sanitizarAtualizacaoProduto valida campos parciais incluindo cupom', () => {
  const patch = sanitizarAtualizacaoProduto({
    precoAtual: 99.5,
    destaque: true,
    linkAfiliado: '',
    validoAte: '',
    cupom: '  ACHADINHO15 ',
  });
  assert.deepEqual(patch, {
    precoAtual: 99.5,
    destaque: true,
    linkAfiliado: null,
    validoAte: null,
    cupom: 'ACHADINHO15',
  });

  const limpaCupom = sanitizarAtualizacaoProduto({ cupom: '   ' });
  assert.deepEqual(limpaCupom, { cupom: null });

  assert.throws(() => sanitizarAtualizacaoProduto({ titulo: '' }));
  assert.throws(() => sanitizarAtualizacaoProduto({ validoAte: '2026-02-31' }));
});

test('validarIdDocumento aceita IDs válidos e rejeita IDs malformados', () => {
  assert.equal(validarIdDocumento('prod_123-abc'), 'prod_123-abc');
  assert.throws(() => validarIdDocumento('../secret'));
  assert.throws(() => validarIdDocumento(''));
});
