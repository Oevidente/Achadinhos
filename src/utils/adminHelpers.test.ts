import test from 'node:test';
import assert from 'node:assert/strict';
import type { Produto } from '../types/produto';
import {
  calcularDescontoPercentual,
  filtrarProdutosAdmin,
  formatarTempoRelativo,
  isEmailAdm,
  isHttpsUrl,
  produtoEstaExpirado,
  validarFormularioProduto,
  type ProdutoFormState,
} from './adminHelpers';

const formValidoBase: ProdutoFormState = {
  linkOriginal: 'https://s.shopee.com.br/abc123',
  plataforma: 'shopee',
  titulo: 'Fone de Ouvido Sem Fio',
  descricao: 'Bluetooth 5.3 com estojo carregador.',
  imagemUrl: 'https://cdn.exemplo.com/fone.jpg',
  precoAtual: '89,90',
  precoOriginal: '149,90',
  linkAfiliado: '',
  status: 'ativo',
  destaque: false,
  validoAte: '',
  cupom: '',
};

test('isEmailAdm valida e-mails ignorando maiúsculas e espaços', () => {
  const lista = ['Admin@Empresa.com', 'outro@gmail.com'];
  assert.equal(isEmailAdm('admin@empresa.com', lista), true);
  assert.equal(isEmailAdm('  OUTRO@GMAIL.COM ', lista), true);
  assert.equal(isEmailAdm('visitante@gmail.com', lista), false);
  assert.equal(isEmailAdm(null, lista), false);
});

test('isHttpsUrl aceita apenas URLs https válidas', () => {
  assert.equal(isHttpsUrl('https://amazon.com.br/dp/B123'), true);
  assert.equal(isHttpsUrl('http://amazon.com.br/dp/B123'), false);
  assert.equal(isHttpsUrl('amazon.com.br/dp/B123'), false);
});

test('validarFormularioProduto exige https, título, preço > 0, preço original >= atual, imagem válida e trata validoAte e cupom opcionais', () => {
  const ok = validarFormularioProduto({
    ...formValidoBase,
    validoAte: '2026-12-25',
    cupom: '  DECO10  ',
  });
  assert.equal(ok.valido, true);
  assert.equal(ok.precoAtualNum, 89.9);
  assert.equal(ok.precoOriginalNum, 149.9);
  assert.equal(ok.validoAteValor, '2026-12-25');
  assert.equal(ok.cupomValor, 'DECO10');

  const semCupom = validarFormularioProduto({ ...formValidoBase, cupom: '   ' });
  assert.equal(semCupom.valido, true);
  assert.equal(semCupom.cupomValor, null);

  const cupomLongo = validarFormularioProduto({
    ...formValidoBase,
    cupom: 'A'.repeat(65),
  });
  assert.equal(cupomLongo.valido, false);
  assert.ok(cupomLongo.erros.cupom);

  const invalido = validarFormularioProduto({
    ...formValidoBase,
    linkOriginal: 'http://shopee.com.br/item',
    titulo: '   ',
    precoAtual: '0',
    precoOriginal: '50',
    imagemUrl: 'invalida',
    validoAte: '2026-99-99',
  });
  assert.equal(invalido.valido, false);
  assert.ok(invalido.erros.linkOriginal);
  assert.ok(invalido.erros.titulo);
  assert.ok(invalido.erros.precoAtual);
  assert.ok(invalido.erros.imagemUrl);
  assert.ok(invalido.erros.validoAte);

  const origMenor = validarFormularioProduto({
    ...formValidoBase,
    precoAtual: '100',
    precoOriginal: '80',
  });
  assert.equal(origMenor.valido, false);
  assert.ok(origMenor.erros.precoOriginal);
});

test('filtrarProdutosAdmin filtra e ordena por mais clicados', () => {
  const itens: Produto[] = [
    {
      id: '1',
      titulo: 'Mouse Gamer RGB',
      descricao: '',
      imagemUrl: 'https://cdn.exemplo.com/1.jpg',
      precoAtual: 129.9,
      precoOriginal: null,
      moeda: 'BRL',
      plataforma: 'amazon',
      linkOriginal: 'https://amazon.com.br/1',
      linkAfiliado: null,
      status: 'ativo',
      origemDados: 'manual',
      destaque: true,
      cliques: 5,
      validoAte: null,
      criadoEm: null,
      atualizadoEm: null,
    },
    {
      id: '2',
      titulo: 'Caneca Anime',
      descricao: '',
      imagemUrl: 'https://cdn.exemplo.com/2.jpg',
      precoAtual: 49.9,
      precoOriginal: 79.9,
      moeda: 'BRL',
      plataforma: 'shopee',
      linkOriginal: 'https://shopee.com.br/2',
      linkAfiliado: null,
      status: 'expirado',
      origemDados: 'manual',
      destaque: false,
      cliques: 22,
      validoAte: null,
      criadoEm: null,
      atualizadoEm: null,
    },
  ];

  assert.equal(
    filtrarProdutosAdmin(itens, { busca: 'mouse', status: 'todos', plataforma: 'todas' }).length,
    1
  );
  assert.equal(
    filtrarProdutosAdmin(itens, { busca: '', status: 'expirado', plataforma: 'todas' }).length,
    1
  );
  assert.equal(
    filtrarProdutosAdmin(itens, { busca: '', status: 'todos', plataforma: 'shopee' })[0]?.id,
    '2'
  );
  assert.deepEqual(
    filtrarProdutosAdmin(itens, {
      busca: '',
      status: 'todos',
      plataforma: 'todas',
      ordenacao: 'mais_clicados',
    }).map((p) => p.id),
    ['2', '1']
  );
});

test('produtoEstaExpirado detecta status expirado ou validoAte vencida', () => {
  const hoje = new Date(2026, 10, 23, 12, 0, 0);
  assert.equal(produtoEstaExpirado({ status: 'expirado', validoAte: null }, hoje), true);
  assert.equal(produtoEstaExpirado({ status: 'ativo', validoAte: '2026-11-22' }, hoje), true);
  assert.equal(produtoEstaExpirado({ status: 'ativo', validoAte: '2026-11-23' }, hoje), false);
  assert.equal(produtoEstaExpirado({ status: 'ativo', validoAte: '2026-11-24' }, hoje), false);
  assert.equal(produtoEstaExpirado({ status: 'ativo', validoAte: null }, hoje), false);
});

test('formatarTempoRelativo formata minutos, horas e dias em português', () => {
  const agora = new Date('2026-11-23T12:00:00Z');
  assert.equal(formatarTempoRelativo(new Date('2026-11-23T11:59:30Z'), agora), 'Preço conferido agora');
  assert.equal(formatarTempoRelativo(new Date('2026-11-23T11:45:00Z'), agora), 'Preço conferido há 15 min');
  assert.equal(formatarTempoRelativo(new Date('2026-11-23T09:00:00Z'), agora), 'Preço conferido há 3 h');
  assert.equal(formatarTempoRelativo(new Date('2026-11-22T12:00:00Z'), agora), 'Preço conferido há 1 dia');
  assert.equal(formatarTempoRelativo(new Date('2026-11-20T12:00:00Z'), agora), 'Preço conferido há 3 dias');
  assert.equal(formatarTempoRelativo(null, agora), '');
});

test('calcularDescontoPercentual calcula desconto inteiro corretamente', () => {
  assert.equal(calcularDescontoPercentual(50, 100), 50);
  assert.equal(calcularDescontoPercentual(100, 100), null);
  assert.equal(calcularDescontoPercentual(100, null), null);
});
