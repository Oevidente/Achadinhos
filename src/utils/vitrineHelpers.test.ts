import test from 'node:test';
import assert from 'node:assert/strict';
import type { Produto } from '../types/produto';
import {
  filtrarEOrdenarVitrine,
  obterPlataformasFiltro,
  obterUrlDestinoOferta,
} from './vitrineHelpers';

const baseProduto = (overrides: Partial<Produto>): Produto => ({
  id: 'id-1',
  titulo: 'Produto Base',
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
  criadoEm: new Date('2026-11-20T10:00:00Z'),
  atualizadoEm: new Date('2026-11-20T10:00:00Z'),
  ...overrides,
});

test('filtrarEOrdenarVitrine oculta produtos inativos, expirados ou com validoAte vencida', () => {
  const hoje = new Date(2026, 10, 23, 12, 0, 0);
  const lista = [
    baseProduto({ id: '1', status: 'ativo', titulo: 'Ativo', validoAte: '2026-11-25' }),
    baseProduto({ id: '2', status: 'inativo', titulo: 'Inativo' }),
    baseProduto({ id: '3', status: 'expirado', titulo: 'Expirado' }),
    baseProduto({ id: '4', status: 'ativo', titulo: 'Vencido', validoAte: '2026-11-22' }),
  ];

  const visiveis = filtrarEOrdenarVitrine(
    lista,
    {
      busca: '',
      plataforma: 'todas',
      ordenacao: 'mais_recentes',
    },
    hoje
  );

  assert.deepEqual(
    visiveis.map((p) => p.id),
    ['1']
  );
});

test('filtrarEOrdenarVitrine ordena por menor preço, maior desconto e mais recentes', () => {
  const lista = [
    baseProduto({
      id: 'antigo-caro',
      precoAtual: 200,
      precoOriginal: 250, // 20%
      criadoEm: new Date('2026-11-01T10:00:00Z'),
    }),
    baseProduto({
      id: 'meio-descontao',
      precoAtual: 50,
      precoOriginal: 200, // 75%
      criadoEm: new Date('2026-11-10T10:00:00Z'),
    }),
    baseProduto({
      id: 'novo-baratinho',
      precoAtual: 30,
      precoOriginal: null, // 0%
      criadoEm: new Date('2026-11-22T10:00:00Z'),
    }),
  ];

  assert.deepEqual(
    filtrarEOrdenarVitrine(lista, {
      busca: '',
      plataforma: 'todas',
      ordenacao: 'mais_recentes',
    }).map((p) => p.id),
    ['novo-baratinho', 'meio-descontao', 'antigo-caro']
  );

  assert.deepEqual(
    filtrarEOrdenarVitrine(lista, {
      busca: '',
      plataforma: 'todas',
      ordenacao: 'menor_preco',
    }).map((p) => p.id),
    ['novo-baratinho', 'meio-descontao', 'antigo-caro']
  );

  assert.deepEqual(
    filtrarEOrdenarVitrine(lista, {
      busca: '',
      plataforma: 'todas',
      ordenacao: 'maior_desconto',
    }).map((p) => p.id),
    ['meio-descontao', 'antigo-caro', 'novo-baratinho']
  );
});

test('obterPlataformasFiltro exibe principais ativas (incluindo Amazon), oculta Magalu e adiciona extras presentes nos ativos', () => {
  const lista = [
    baseProduto({ id: '1', plataforma: 'kabum', status: 'ativo' }),
    baseProduto({ id: '2', plataforma: 'aliexpress', status: 'inativo' }),
    baseProduto({ id: '3', plataforma: 'amazon', status: 'ativo' }),
    baseProduto({ id: '4', plataforma: 'magalu', status: 'ativo' }),
  ];

  const chips = obterPlataformasFiltro(lista);
  assert.equal(chips.includes('shopee'), true);
  assert.equal(chips.includes('mercado_livre'), true);
  assert.equal(chips.includes('amazon'), true);
  assert.equal(chips.includes('tiktok_shop'), true);
  assert.equal(chips.includes('magalu'), false);
  assert.equal(chips.includes('kabum'), true);
  assert.equal(chips.includes('aliexpress'), false);
});

test('filtrarEOrdenarVitrine exibe Amazon e oculta apenas lojas temporariamente ocultas (Magalu)', () => {
  const lista = [
    baseProduto({ id: 's1', plataforma: 'shopee', status: 'ativo' }),
    baseProduto({ id: 'a1', plataforma: 'amazon', status: 'ativo' }),
    baseProduto({ id: 'm1', plataforma: 'magalu', status: 'ativo' }),
  ];

  const visiveis = filtrarEOrdenarVitrine(lista, {
    busca: '',
    plataforma: 'todas',
    ordenacao: 'mais_recentes',
  });

  assert.deepEqual(
    visiveis.map((p) => p.id),
    ['s1', 'a1']
  );
});

test('obterUrlDestinoOferta prioriza linkAfiliado sobre linkOriginal', () => {
  assert.equal(
    obterUrlDestinoOferta({
      linkOriginal: 'https://shopee.com.br/original',
      linkAfiliado: 'https://s.shopee.com.br/afiliado',
    }),
    'https://s.shopee.com.br/afiliado'
  );

  assert.equal(
    obterUrlDestinoOferta({
      linkOriginal: 'https://amazon.com.br/dp/123',
      linkAfiliado: null,
    }),
    'https://amazon.com.br/dp/123'
  );
});

test('filtrarEOrdenarVitrine encontra produtos pelo código do cupom', () => {
  const lista = [
    baseProduto({ id: '1', titulo: 'Teclado Mecânico', cupom: 'DECO20' }),
    baseProduto({ id: '2', titulo: 'Mouse Pad', cupom: null }),
  ];

  const encontrados = filtrarEOrdenarVitrine(lista, {
    busca: 'deco20',
    plataforma: 'todas',
    ordenacao: 'mais_recentes',
  });

  assert.deepEqual(
    encontrados.map((p) => p.id),
    ['1']
  );
});

test('filtrarEOrdenarVitrine filtra por categoria (explícita e automática) e busca pelo nome da categoria', () => {
  const lista = [
    baseProduto({
      id: 'ps5',
      titulo: 'PlayStation 5 Slim',
      categoria: 'tech_gamer',
    }),
    baseProduto({
      id: 'airfryer',
      titulo: 'Fritadeira Elétrica Air Fryer',
      categoria: null,
    }),
    baseProduto({
      id: 'fone',
      titulo: 'Fone JBL Bluetooth',
      categoria: null,
    }),
  ];

  assert.deepEqual(
    filtrarEOrdenarVitrine(lista, {
      busca: '',
      plataforma: 'todas',
      categoria: 'casa_cozinha',
      ordenacao: 'mais_recentes',
    }).map((p) => p.id),
    ['airfryer']
  );

  assert.deepEqual(
    filtrarEOrdenarVitrine(lista, {
      busca: 'tech & gamer',
      plataforma: 'todas',
      categoria: 'todas',
      ordenacao: 'mais_recentes',
    }).map((p) => p.id),
    ['ps5']
  );
});
