import test from 'node:test';
import assert from 'node:assert/strict';
import type { Produto } from '../types/produto';
import {
  MAX_DESTAQUES_INTELIGENTES_VITRINE,
  avaliarApeloProduto,
  selecionarDestaquesVitrine,
} from './destaquesInteligentes';

const baseProduto = (overrides: Partial<Produto>): Produto => ({
  id: 'id-1',
  titulo: 'Produto Genérico',
  descricao: '',
  imagemUrl: 'https://cdn.exemplo.com/img.jpg',
  precoAtual: 100,
  precoOriginal: null,
  moeda: 'BRL',
  plataforma: 'shopee',
  linkOriginal: 'https://shopee.com.br/item',
  linkAfiliado: null,
  status: 'ativo',
  origemDados: 'manual',
  destaque: false,
  cliques: 0,
  validoAte: null,
  cupom: null,
  categoria: null,
  criadoEm: new Date('2026-11-24T10:00:00Z'),
  atualizadoEm: new Date('2026-11-24T10:00:00Z'),
  ...overrides,
});

test('avaliarApeloProduto identifica alto apelo por desconto forte + economia + tipo de produto', () => {
  const ref = new Date('2026-11-25T10:00:00Z');
  const cadeira = baseProduto({
    id: 'cadeira',
    titulo: 'Cadeira Escritório Ergonômica Giratória',
    precoAtual: 97.83,
    precoOriginal: 299.9,
  });

  const avaliacao = avaliarApeloProduto(cadeira, ref);
  assert.equal(avaliacao.ehDestaqueInteligente, true);
  assert.ok(avaliacao.score >= 50);
  assert.equal(avaliacao.motivoPrincipal, '-67% OFF');
});

test('avaliarApeloProduto combina cupom, cliques reais e termo desejado mesmo sem grande desconto', () => {
  const ref = new Date('2026-11-25T10:00:00Z');
  const fone = baseProduto({
    id: 'fone',
    titulo: 'Fone Bluetooth JBL Original',
    precoAtual: 199,
    precoOriginal: 249, // 20%
    cupom: 'JBL15',
    cliques: 12,
  });

  const avaliacao = avaliarApeloProduto(fone, ref);
  assert.equal(avaliacao.ehDestaqueInteligente, true);
  assert.equal(avaliacao.motivos.includes('Com cupom'), true);
  assert.equal(avaliacao.motivos.includes('Em alta'), true);
});

test('avaliarApeloProduto não destaca produto comum sem desconto expressivo, cupom ou procura', () => {
  const ref = new Date('2026-11-25T10:00:00Z');
  const comum = baseProduto({
    id: 'comum',
    titulo: 'Adaptador Simples Plástico',
    precoAtual: 19.9,
    precoOriginal: 22.0, // 10%
    cliques: 0,
  });

  const avaliacao = avaliarApeloProduto(comum, ref);
  assert.equal(avaliacao.ehDestaqueInteligente, false);
});

test('selecionarDestaquesVitrine preserva todos os destaques manuais e adiciona inteligentes até o limite', () => {
  const ref = new Date('2026-11-25T10:00:00Z');
  const manualComum = baseProduto({
    id: 'manual-1',
    titulo: 'Item Escolhido Manualmente',
    precoAtual: 50,
    precoOriginal: null,
    destaque: true,
  });
  const autoAlto = baseProduto({
    id: 'auto-1',
    titulo: 'Smart TV QLED 4K 55',
    precoAtual: 2199,
    precoOriginal: 3999, // -45%, economia 1800
    cupom: 'TV200',
    destaque: false,
  });
  const comum = baseProduto({
    id: 'comum-1',
    titulo: 'Cabo Básico 1m',
    precoAtual: 15,
    precoOriginal: null,
    destaque: false,
  });

  const resultado = selecionarDestaquesVitrine([manualComum, autoAlto, comum], {
    maxAutomaticos: 4,
    referencia: ref,
  });

  assert.deepEqual(
    resultado.destaques.map((p) => p.id),
    ['manual-1', 'auto-1']
  );
  assert.equal(resultado.idsDestaqueInteligente.has('manual-1'), false);
  assert.equal(resultado.idsDestaqueInteligente.has('auto-1'), true);
  assert.deepEqual(
    resultado.demaisOfertas.map((p) => p.id),
    ['comum-1']
  );
});

test('selecionarDestaquesVitrine retorna lista vazia de destaques quando desabilitado por filtro ativo', () => {
  const manual = baseProduto({ id: 'm1', destaque: true });
  const resultado = selecionarDestaquesVitrine([manual], {
    desabilitarDestaques: true,
  });

  assert.equal(resultado.destaques.length, 0);
  assert.deepEqual(
    resultado.demaisOfertas.map((p) => p.id),
    ['m1']
  );
});

test('selecionarDestaquesVitrine limita destaques automáticos ao padrão de 8 quando não informado maxAutomaticos', () => {
  const ref = new Date('2026-11-25T10:00:00Z');
  assert.equal(MAX_DESTAQUES_INTELIGENTES_VITRINE, 8);

  const candidatos = Array.from({ length: 10 }, (_, idx) =>
    baseProduto({
      id: `auto-${idx + 1}`,
      titulo: `Smart TV QLED 4K Modelo ${idx + 1}`,
      precoAtual: 1999,
      precoOriginal: 3999,
      cupom: 'TVOFF',
      cliques: 25 - idx,
      destaque: false,
      criadoEm: new Date(`2026-11-24T${String(10 + idx).padStart(2, '0')}:00:00Z`),
    })
  );

  const resultado = selecionarDestaquesVitrine(candidatos, { referencia: ref });

  assert.equal(resultado.destaques.length, 8);
  assert.equal(resultado.idsDestaqueInteligente.size, 8);
  assert.equal(resultado.demaisOfertas.length, 2);
});

