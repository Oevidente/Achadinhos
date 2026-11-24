import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { ExternalLink, LogOut } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { comBasePath, type AppRoute } from '../utils/router';

interface AdminLayoutProps {
  user: User;
  route: AppRoute;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function AdminLayout({
  user,
  route,
  onNavigate,
  onSignOut,
  children,
}: AdminLayoutProps) {
  const linkClass = (ativo: boolean) =>
    `text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 pb-1 border-b-2 transition-colors cursor-pointer ${
      ativo
        ? 'text-[#22C55E] border-[#22C55E]'
        : 'text-slate-300 border-transparent hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex flex-col">
      <header className="border-b border-[#1E2A20] bg-[#0B100C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-6">
          <a
            href={comBasePath('/admin', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/admin');
            }}
            className="inline-flex items-center whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#22C55E] rounded-lg"
          >
            <BrandLogo tamanho="sm" />
          </a>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 sm:order-3">
            <a
              href={comBasePath('/', import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#1E2A20] bg-[#0F1410] hover:bg-[#19231B] text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Vitrine</span>
            </a>
            <span className="hidden lg:inline-block text-xs text-slate-400 truncate max-w-[180px]">
              {user.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border border-[#1E2A20] bg-[#0F1410] hover:bg-[#19231B] text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>

          <nav
            aria-label="Navegação do painel"
            className="w-full sm:w-auto flex items-center gap-5 sm:gap-6 pt-1 sm:pt-0 border-t border-[#141E16] sm:border-t-0 sm:order-2"
          >
            <a
              href={comBasePath('/admin', import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className={linkClass(route.name === 'admin_list')}
            >
              Produtos
            </a>
            <a
              href={comBasePath('/admin/novo', import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin/novo');
              }}
              className={linkClass(route.name === 'admin_new')}
            >
              Novo produto
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
