import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarCategoria,
  obterCategoriaEfetiva,
  obterNomeCategoria,
  sugerirCategoriaProduto,
} from './categorias';

test('normalizarCategoria valida valores permitidos e ignora inválidos', () => {
  assert.equal(normalizarCategoria('tech_gamer'), 'tech_gamer');
  assert.equal(normalizarCategoria('  casa_cozinha  '), 'casa_cozinha');
  assert.equal(normalizarCategoria(''), null);
  assert.equal(normalizarCategoria(null), null);
  assert.equal(normalizarCategoria('inexistente'), null);
});

test('obterNomeCategoria retorna rótulo legível para categoria válida', () => {
  assert.equal(obterNomeCategoria('tech_gamer'), 'Tech & Gamer');
  assert.equal(obterNomeCategoria('celulares_audio'), 'Celulares & Áudio');
  assert.equal(obterNomeCategoria(null), '');
});

test('sugerirCategoriaProduto classifica títulos sem acento ou com acento corretamente', () => {
  assert.equal(
    sugerirCategoriaProduto('Console PlayStation 5 Slim 1TB'),
    'tech_gamer'
  );
  assert.equal(
    sugerirCategoriaProduto('Fone de Ouvido JBL Bluetooth sem fio'),
    'celulares_audio'
  );
  assert.equal(
    sugerirCategoriaProduto('Apple iPhone 15 128GB'),
    'celulares_audio'
  );
  assert.equal(
    sugerirCategoriaProduto('Fritadeira Elétrica Air Fryer 4L'),
    'casa_cozinha'
  );
  assert.equal(
    sugerirCategoriaProduto('Tênis de Corrida Masculino'),
    'moda_beleza'
  );
  assert.equal(
    sugerirCategoriaProduto('Whey Protein Concentrado 900g'),
    'esporte_lazer'
  );
  assert.equal(
    sugerirCategoriaProduto('Parafusadeira e Furadeira a Bateria'),
    'ferramentas_auto'
  );
  assert.equal(
    sugerirCategoriaProduto('Caneca Colecionável Presente Criativo'),
    'presentes_variedades'
  );
  assert.equal(sugerirCategoriaProduto('Item genérico sem palavra-chave'), null);
});

test('obterCategoriaEfetiva respeita categoria explícita e faz fallback para sugestão quando null', () => {
  assert.equal(
    obterCategoriaEfetiva({
      categoria: 'outros',
      titulo: 'Teclado Mecânico Gamer RGB',
      descricao: '',
    }),
    'outros'
  );

  assert.equal(
    obterCategoriaEfetiva({
      categoria: null,
      titulo: 'Teclado Mecânico Gamer RGB',
      descricao: '',
    }),
    'tech_gamer'
  );
});
