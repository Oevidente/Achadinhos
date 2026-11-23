import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comBasePath,
  isAdminProtectedRoute,
  parseRoute,
  removerBasePath,
} from './router';

test('parseRoute resolve todas as rotas do painel ADM e raiz', () => {
  assert.deepEqual(parseRoute('/'), { name: 'home' });
  assert.deepEqual(parseRoute('/admin'), { name: 'admin_list' });
  assert.deepEqual(parseRoute('/admin/'), { name: 'admin_list' });
  assert.deepEqual(parseRoute('/admin/login'), { name: 'admin_login' });
  assert.deepEqual(parseRoute('/admin/novo'), { name: 'admin_new' });
  assert.deepEqual(parseRoute('/p/prod_abc'), {
    name: 'produto_detalhe',
    id: 'prod_abc',
  });
  assert.deepEqual(parseRoute('/admin/editar/prod_123'), {
    name: 'admin_edit',
    id: 'prod_123',
  });
});

test('isAdminProtectedRoute protege apenas rotas internas do painel ADM', () => {
  assert.equal(isAdminProtectedRoute(parseRoute('/')), false);
  assert.equal(isAdminProtectedRoute(parseRoute('/p/prod_abc')), false);
  assert.equal(isAdminProtectedRoute(parseRoute('/admin/login')), false);
  assert.equal(isAdminProtectedRoute(parseRoute('/admin')), true);
  assert.equal(isAdminProtectedRoute(parseRoute('/admin/novo')), true);
  assert.equal(isAdminProtectedRoute(parseRoute('/admin/editar/abc')), true);
});

test('removerBasePath e comBasePath suportam subdiretório do GitHub Pages e raiz', () => {
  assert.equal(removerBasePath('/achadinhos-hub/', '/achadinhos-hub/'), '/');
  assert.equal(removerBasePath('/achadinhos-hub', '/achadinhos-hub/'), '/');
  assert.equal(removerBasePath('/achadinhos-hub/p/prod_1', '/achadinhos-hub/'), '/p/prod_1');
  assert.equal(removerBasePath('/achadinhos-hub/admin/novo', '/achadinhos-hub/'), '/admin/novo');

  assert.equal(comBasePath('/', '/achadinhos-hub/'), '/achadinhos-hub/');
  assert.equal(comBasePath('/p/prod_1', '/achadinhos-hub/'), '/achadinhos-hub/p/prod_1');
  assert.equal(comBasePath('/admin', '/'), '/admin');
});
