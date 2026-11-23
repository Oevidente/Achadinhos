import { AlertCircle } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { comBasePath } from '../utils/router';

interface AdminLoginPageProps {
  semPermissao: boolean;
  emailAtual: string | null;
  authLoading: boolean;
  authError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onNavigateHome: () => void;
}

export function AdminLoginPage({
  semPermissao,
  emailAtual,
  authLoading,
  authError,
  onSignIn,
  onSignOut,
  onNavigateHome,
}: AdminLoginPageProps) {
  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1E2A20] bg-[#0F1410] p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <BrandLogo tamanho="lg" mostrarTexto={false} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Painel Administrativo
            </h1>
            <p className="text-xs text-slate-400">Achadinhos do Deco</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Entre com sua conta Google autorizada para cadastrar, editar e gerenciar os
          produtos em promoção.
        </p>

        {semPermissao && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Sem permissão</p>
              <p className="text-xs text-red-300/90">
                {emailAtual
                  ? `A conta ${emailAtual} não faz parte da lista de administradores.`
                  : 'Faça login com um e-mail autorizado para acessar o painel.'}
              </p>
            </div>
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-200"
          >
            {authError}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={onSignIn}
            disabled={authLoading}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{authLoading ? 'Conectando...' : 'Entrar com Google'}</span>
          </button>

          {emailAtual && (
            <button
              type="button"
              onClick={onSignOut}
              disabled={authLoading}
              className="w-full py-2 px-4 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#161E17] text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              Desconectar conta atual
            </button>
          )}
        </div>

        <div className="pt-2 border-t border-[#1E2A20] text-center">
          <a
            href={comBasePath('/', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}
