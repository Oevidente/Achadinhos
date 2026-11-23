export type AppRoute =
  | { name: 'home' }
  | { name: 'produto_detalhe'; id: string }
  | { name: 'admin_login' }
  | { name: 'admin_list' }
  | { name: 'admin_new' }
  | { name: 'admin_edit'; id: string };

export function normalizarBasePath(base: string = '/'): string {
  const limpo = base.trim();
  if (!limpo || limpo === '/') return '';
  const comBarra = limpo.startsWith('/') ? limpo : `/${limpo}`;
  return comBarra.replace(/\/+$/, '');
}

export function normalizarPathname(pathname: string): string {
  const limpo = pathname.trim();
  if (!limpo || limpo === '/') return '/';
  return limpo.replace(/\/+$/, '') || '/';
}

export function removerBasePath(pathname: string, base: string = '/'): string {
  const prefixo = normalizarBasePath(base);
  const path = normalizarPathname(pathname);
  if (!prefixo) return path;
  if (path === prefixo) return '/';
  if (path.startsWith(`${prefixo}/`)) {
    return normalizarPathname(path.slice(prefixo.length));
  }
  return path;
}

export function comBasePath(rota: string, base: string = '/'): string {
  const prefixo = normalizarBasePath(base);
  const rotaNorm = normalizarPathname(rota);
  if (!prefixo) return rotaNorm;
  if (rotaNorm === '/') return `${prefixo}/`;
  return `${prefixo}${rotaNorm}`;
}

export function parseRoute(pathname: string): AppRoute {
  const path = normalizarPathname(pathname);

  if (path === '/') {
    return { name: 'home' };
  }
  if (path.startsWith('/p/')) {
    const idBruto = path.slice('/p/'.length);
    const id = decodeURIComponent(idBruto).trim();
    if (id && !id.includes('/')) {
      return { name: 'produto_detalhe', id };
    }
  }
  if (path === '/admin/login') {
    return { name: 'admin_login' };
  }
  if (path === '/admin') {
    return { name: 'admin_list' };
  }
  if (path === '/admin/novo') {
    return { name: 'admin_new' };
  }
  if (path.startsWith('/admin/editar/')) {
    const idBruto = path.slice('/admin/editar/'.length);
    const id = decodeURIComponent(idBruto).trim();
    if (id && !id.includes('/')) {
      return { name: 'admin_edit', id };
    }
  }
  if (path.startsWith('/admin')) {
    return { name: 'admin_list' };
  }

  return { name: 'home' };
}

export function isAdminProtectedRoute(route: AppRoute): boolean {
  return (
    route.name === 'admin_list' ||
    route.name === 'admin_new' ||
    route.name === 'admin_edit'
  );
}
