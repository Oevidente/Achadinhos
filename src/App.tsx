import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { AdminLayout } from './components/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, type ToastItem } from './components/ToastContainer';
import { ADMIN_EMAILS } from './config';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminProdutoFormPage } from './pages/AdminProdutoFormPage';
import { AdminProdutosPage } from './pages/AdminProdutosPage';
import { ProdutoDetalhePage } from './pages/ProdutoDetalhePage';
import { VitrinePage } from './pages/VitrinePage';
import { auth, loginComGoogleAdm, logoutAdm } from './services/firebase';
import { isEmailAdm } from './utils/adminHelpers';
import {
  comBasePath,
  isAdminProtectedRoute,
  normalizarPathname,
  parseRoute,
  removerBasePath,
  type AppRoute,
} from './utils/router';

const BASE_URL = import.meta.env.BASE_URL || '/';

export default function App() {
  const [pathname, setPathname] = useState<string>(() =>
    removerBasePath(window.location.pathname, BASE_URL)
  );
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [negadoAcesso, setNegadoAcesso] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const route: AppRoute = parseRoute(pathname);
  const usuarioEhAdm = isEmailAdm(user?.email, ADMIN_EMAILS);

  const adicionarToast = useCallback((tipo: 'sucesso' | 'erro', mensagem: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, tipo, mensagem }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const removerToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const navigate = useCallback((destino: string, replace = false) => {
    const rotaInterna = normalizarPathname(destino);
    const urlDestino = comBasePath(rotaInterna, BASE_URL);
    if (window.location.pathname === urlDestino) return;
    if (replace) {
      window.history.replaceState(null, '', urlDestino);
    } else {
      window.history.pushState(null, '', urlDestino);
    }
    setPathname(rotaInterna);
  }, []);

  useEffect(() => {
    const onPopState = () =>
      setPathname(removerBasePath(window.location.pathname, BASE_URL));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Guarda de rota ADM
  useEffect(() => {
    if (!authReady) return;

    if (isAdminProtectedRoute(route)) {
      if (!user || !usuarioEhAdm) {
        setNegadoAcesso(true);
        navigate('/admin/login', true);
      }
      return;
    }

    if (route.name === 'admin_login' && user && usuarioEhAdm) {
      setNegadoAcesso(false);
      navigate('/admin', true);
    }
  }, [authReady, route, user, usuarioEhAdm, navigate]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const signedUser = await loginComGoogleAdm();
      if (!isEmailAdm(signedUser.email, ADMIN_EMAILS)) {
        setNegadoAcesso(true);
      } else {
        setNegadoAcesso(false);
        navigate('/admin');
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Não foi possível entrar com o Google.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await logoutAdm();
      setNegadoAcesso(false);
      navigate('/admin/login');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Erro ao sair da conta.');
    } finally {
      setAuthLoading(false);
    }
  };

  const renderContent = () => {
    if (route.name === 'home') {
      return <VitrinePage onNavigate={(path) => navigate(path)} />;
    }

    if (route.name === 'produto_detalhe') {
      return (
        <ProdutoDetalhePage
          produtoId={route.id}
          onNavigate={(path) => navigate(path)}
          onToast={adicionarToast}
        />
      );
    }

    if (!authReady) {
      return (
        <div className="min-h-screen bg-[#070A07] text-slate-300 flex items-center justify-center gap-3 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#22C55E]" />
          Verificando sessão...
        </div>
      );
    }

    if (route.name === 'admin_login') {
      const semPermissao = negadoAcesso || (Boolean(user) && !usuarioEhAdm);
      return (
        <AdminLoginPage
          semPermissao={semPermissao}
          emailAtual={user?.email ?? null}
          authLoading={authLoading}
          authError={authError}
          onSignIn={() => void handleSignIn()}
          onSignOut={() => void handleSignOut()}
          onNavigateHome={() => navigate('/')}
        />
      );
    }

    if (!user || !usuarioEhAdm) {
      return null;
    }

    return (
      <AdminLayout
        user={user}
        route={route}
        onNavigate={(path) => navigate(path)}
        onSignOut={() => void handleSignOut()}
      >
        {route.name === 'admin_list' && (
          <AdminProdutosPage
            onNavigate={(path) => navigate(path)}
            onToast={adicionarToast}
          />
        )}
        {route.name === 'admin_new' && (
          <AdminProdutoFormPage
            onNavigate={(path) => navigate(path)}
            onToast={adicionarToast}
          />
        )}
        {route.name === 'admin_edit' && (
          <AdminProdutoFormPage
            produtoId={route.id}
            onNavigate={(path) => navigate(path)}
            onToast={adicionarToast}
          />
        )}
      </AdminLayout>
    );
  };

  return (
    <ErrorBoundary>
      {renderContent()}
      <ToastContainer toasts={toasts} onDismiss={removerToast} />
    </ErrorBoundary>
  );
}
