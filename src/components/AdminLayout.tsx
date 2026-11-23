import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { LogOut, ShoppingBag } from 'lucide-react';
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
    `text-sm font-medium whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors cursor-pointer ${
      ativo
        ? 'text-[#22C55E] border-[#22C55E]'
        : 'text-slate-300 border-transparent hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex flex-col">
      <header className="border-b border-[#1E2A20] bg-[#0B100C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href={comBasePath('/admin', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/admin');
            }}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#22C55E] rounded-lg"
          >
            <span className="w-8 h-8 rounded-lg bg-[#22C55E] text-[#070A07] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              Achadinhos Hub
            </span>
          </a>

          <nav aria-label="Navegação do painel" className="flex items-center gap-5 sm:gap-6">
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

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline-block text-xs text-slate-400 truncate max-w-[200px]">
              {user.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2A20] bg-[#0F1410] hover:bg-[#19231B] text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
