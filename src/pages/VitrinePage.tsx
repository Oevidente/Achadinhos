import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Dumbbell,
  Gamepad2,
  Gift,
  Home,
  LayoutGrid,
  Loader2,
  Search,
  Shirt,
  Smartphone,
  Tag,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { CardProduto } from '../components/CardProduto';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { WhatsAppBanner } from '../components/WhatsAppBanner';
import { listarProdutosAtivosPaginado } from '../services/produtosService';
import type { CategoriaProduto, Plataforma, Produto } from '../types/produto';
import { CATEGORIAS_CONFIG } from '../utils/categorias';
import { PLATAFORMAS_CONFIG } from '../utils/plataformas';
import { comBasePath } from '../utils/router';
import {
  filtrarEOrdenarVitrine,
  obterCategoriasVitrine,
  obterPlataformasFiltro,
  PLATAFORMAS_PRINCIPAIS_VITRINE,
  type OrdenacaoVitrine,
} from '../utils/vitrineHelpers';

interface VitrinePageProps {
  onNavigate: (path: string) => void;
}

const ICONES_CATEGORIA: Record<CategoriaProduto, LucideIcon> = {
  tech_gamer: Gamepad2,
  celulares_audio: Smartphone,
  casa_cozinha: Home,
  moda_beleza: Shirt,
  esporte_lazer: Dumbbell,
  ferramentas_auto: Wrench,
  presentes_variedades: Gift,
  outros: Tag,
};

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-[#0F1410] border border-[#1E2A20] p-3 space-y-3 animate-pulse">
      <div className="aspect-square rounded-lg bg-[#161F18]" />
      <div className="space-y-2">
        <div className="h-3.5 rounded bg-[#161F18] w-11/12" />
        <div className="h-3.5 rounded bg-[#161F18] w-2/3" />
      </div>
      <div className="h-5 rounded bg-[#161F18] w-1/2" />
      <div className="h-10 rounded-lg bg-[#161F18]" />
    </div>
  );
}

export function VitrinePage({ onNavigate }: VitrinePageProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [plataformaSelecionada, setPlataformaSelecionada] = useState<'todas' | Plataforma>('todas');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<'todas' | CategoriaProduto>(
    'todas'
  );
  const [ordenacao, setOrdenacao] = useState<OrdenacaoVitrine>('mais_recentes');

  const carregarPrimeiraPagina = useCallback(async () => {
    setCarregandoInicial(true);
    setErro(null);
    try {
      const pagina = await listarProdutosAtivosPaginado({ tamanhoPagina: 24 });
      setProdutos(pagina.itens);
      setCursor(pagina.ultimoCursor);
      setTemMais(pagina.temMais);
    } catch {
      setErro(
        'Não foi possível carregar as ofertas no momento. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setCarregandoInicial(false);
    }
  }, []);

  useEffect(() => {
    void carregarPrimeiraPagina();
  }, [carregarPrimeiraPagina]);

  const carregarMaisOfertas = async () => {
    if (!temMais || !cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const pagina = await listarProdutosAtivosPaginado({
        tamanhoPagina: 24,
        cursor,
      });
      setProdutos((prev) => {
        const idsExistentes = new Set(prev.map((item) => item.id));
        const novos = pagina.itens.filter((item) => !idsExistentes.has(item.id));
        return [...prev, ...novos];
      });
      setCursor(pagina.ultimoCursor);
      setTemMais(pagina.temMais);
    } catch {
      setErro('Não foi possível carregar mais ofertas. Verifique sua conexão.');
    } finally {
      setCarregandoMais(false);
    }
  };

  const plataformasChips = useMemo(() => obterPlataformasFiltro(produtos), [produtos]);
  const categoriasChips = useMemo(() => obterCategoriasVitrine(), []);

  const produtosVisiveis = useMemo(
    () =>
      filtrarEOrdenarVitrine(produtos, {
        busca,
        plataforma: plataformaSelecionada,
        categoria: categoriaSelecionada,
        ordenacao,
      }),
    [produtos, busca, plataformaSelecionada, categoriaSelecionada, ordenacao]
  );

  const temFiltroAtivo =
    busca.trim() !== '' ||
    plataformaSelecionada !== 'todas' ||
    categoriaSelecionada !== 'todas';

  const destaques = useMemo(
    () => (temFiltroAtivo ? [] : produtosVisiveis.filter((produto) => produto.destaque)),
    [produtosVisiveis, temFiltroAtivo]
  );

  const demaisOfertas = useMemo(() => {
    if (temFiltroAtivo || destaques.length === 0) return produtosVisiveis;
    return produtosVisiveis.filter((produto) => !produto.destaque);
  }, [produtosVisiveis, temFiltroAtivo, destaques.length]);

  const tituloSecaoOfertas = useMemo(() => {
    if (categoriaSelecionada !== 'todas') {
      return CATEGORIAS_CONFIG[categoriaSelecionada].nome;
    }
    if (plataformaSelecionada !== 'todas') {
      return `Ofertas em ${PLATAFORMAS_CONFIG[plataformaSelecionada].nome}`;
    }
    if (busca.trim() !== '') {
      return 'Resultados da busca';
    }
    return destaques.length > 0 ? 'Mais ofertas' : 'Ofertas em promoção';
  }, [categoriaSelecionada, plataformaSelecionada, busca, destaques.length]);

  const rolarParaSecao = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const resetarFiltros = () => {
    setBusca('');
    setPlataformaSelecionada('todas');
    setCategoriaSelecionada('todas');
    setOrdenacao('mais_recentes');
  };

  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex flex-col">
      {/* Cabeçalho principal */}
      <header className="border-b border-[#1A261C] bg-[#090E0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 lg:gap-6">
          <div className="flex items-center justify-between gap-4">
            <a
              href={comBasePath('/', import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                resetarFiltros();
              }}
              className="inline-flex items-center whitespace-nowrap shrink-0"
            >
              <BrandLogo tamanho="md" />
            </a>

            <div className="flex items-center gap-2.5 lg:hidden">
              <PWAInstallButton />
              <a
                href={comBasePath('/admin', import.meta.env.BASE_URL)}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/admin');
                }}
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap"
              >
                Painel ADM
              </a>
            </div>
          </div>

          <div className="relative w-full lg:max-w-xl flex items-center">
            <label htmlFor="vitrine-busca" className="sr-only">
              Buscar ofertas
            </label>
            <input
              id="vitrine-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto, categoria ou cupom..."
              className="w-full min-h-[44px] rounded-full border border-[#233226] bg-[#121914] pl-5 pr-20 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#22C55E]"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => rolarParaSecao('secao-ofertas')}
              aria-label="Buscar ofertas"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <PWAInstallButton />
          </div>
        </div>

        {/* Sub-barra de filtros de plataforma e ordenação */}
        <div className="border-t border-[#141E16] bg-[#070B08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
            <div
              role="group"
              aria-label="Filtrar por loja"
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 pr-4 sm:pr-0 [mask-image:linear-gradient(to_right,black_92%,transparent)] sm:[mask-image:none]"
            >
              <button
                type="button"
                aria-pressed={plataformaSelecionada === 'todas'}
                onClick={() => setPlataformaSelecionada('todas')}
                className={`inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  plataformaSelecionada === 'todas'
                    ? 'bg-[#22C55E] text-[#052E16]'
                    : 'text-slate-300 hover:text-white hover:bg-[#121B14]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Todas as lojas</span>
              </button>

              {plataformasChips.map((platId) => {
                const config = PLATAFORMAS_CONFIG[platId];
                const ativa = plataformaSelecionada === platId;
                return (
                  <div key={platId} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span aria-hidden="true" className="text-[#1F2D22] select-none hidden sm:inline">
                      |
                    </span>
                    <button
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => setPlataformaSelecionada(platId)}
                      className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        ativa
                          ? 'bg-[#22C55E] text-[#052E16] font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-[#121B14]'
                      }`}
                    >
                      {config.nome}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <label htmlFor="vitrine-ordenacao" className="text-xs text-slate-400 whitespace-nowrap">
                Ordenar por
              </label>
              <select
                id="vitrine-ordenacao"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as OrdenacaoVitrine)}
                className="min-h-[34px] rounded-lg border border-[#1E2A20] bg-[#0D130E] px-3 py-1 text-xs text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="mais_recentes">Mais recentes</option>
                <option value="menor_preco">Menor preço</option>
                <option value="maior_desconto">Maior desconto</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-7">
        {/* Banner Hero compacto */}
        <section
          aria-label="Apresentação da vitrine"
          className="relative overflow-hidden rounded-2xl border border-[#1E2F21] bg-gradient-to-br from-[#0B140D] via-[#09120B] to-[#0E2B14] px-5 py-6 sm:px-8 sm:py-7"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#22C55E]/18 blur-3xl"
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-[1.15]">
                Encontre tudo o que{' '}
                <span className="text-[#22C55E]">você precisa</span>
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Ofertas selecionadas e conferidas das melhores lojas, organizadas por categoria
                com redirecionamento direto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {!carregandoInicial && !erro && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-[#22C55E]/30 bg-[#0D1E11]/80 text-xs font-semibold text-[#4ADE80] tabular-nums whitespace-nowrap">
                  {produtosVisiveis.length}{' '}
                  {produtosVisiveis.length === 1 ? 'oferta ativa' : 'ofertas ativas'}
                </span>
              )}
              <button
                type="button"
                onClick={() => rolarParaSecao('secao-ofertas')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Explorar ofertas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Banner do grupo de ofertas do WhatsApp */}
        <WhatsAppBanner />

        {/* Faixa de Categorias reais */}
        <section aria-label="Categorias de produtos" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Categorias
            </h2>
            {categoriaSelecionada !== 'todas' && (
              <button
                type="button"
                onClick={() => setCategoriaSelecionada('todas')}
                className="text-xs font-semibold text-[#22C55E] hover:text-[#4ADE80] cursor-pointer"
              >
                Ver todas as categorias
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filtrar por categoria"
            className="flex lg:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0"
          >
            <button
              type="button"
              aria-pressed={categoriaSelecionada === 'todas'}
              onClick={() => setCategoriaSelecionada('todas')}
              className={`inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoriaSelecionada === 'todas'
                  ? 'border-[#22C55E] bg-[#102415] text-[#4ADE80] font-semibold shadow-[0_0_16px_rgba(34,197,94,0.16)]'
                  : 'border-[#1E2A20] bg-[#0D130E] text-slate-300 hover:border-[#22C55E]/50 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span>Todas</span>
            </button>

            {categoriasChips.map((catId) => {
              const config = CATEGORIAS_CONFIG[catId];
              const Icon = ICONES_CATEGORIA[catId];
              const ativa = categoriaSelecionada === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => setCategoriaSelecionada(ativa ? 'todas' : catId)}
                  className={`inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    ativa
                      ? 'border-[#22C55E] bg-[#102415] text-[#4ADE80] font-semibold shadow-[0_0_16px_rgba(34,197,94,0.16)]'
                      : 'border-[#1E2A20] bg-[#0D130E] text-slate-300 hover:border-[#22C55E]/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#22C55E]" />
                  <span>{config.nome}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Seletor de ordenação no mobile */}
        <div className="flex sm:hidden items-center justify-between gap-3">
          <label htmlFor="vitrine-ordenacao-mobile" className="text-xs text-slate-400">
            Ordenar por
          </label>
          <select
            id="vitrine-ordenacao-mobile"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as OrdenacaoVitrine)}
            className="min-h-[38px] rounded-lg border border-[#1E2A20] bg-[#0F1410] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22C55E]"
          >
            <option value="mais_recentes">Mais recentes</option>
            <option value="menor_preco">Menor preço</option>
            <option value="maior_desconto">Maior desconto</option>
          </select>
        </div>

        {/* Estado de erro / carregando / vazio / produtos reais */}
        {erro ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-red-200"
          >
            <span>{erro}</span>
            <button
              type="button"
              onClick={() => void carregarPrimeiraPagina()}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-white cursor-pointer self-start"
            >
              Tentar novamente
            </button>
          </div>
        ) : carregandoInicial ? (
          <section aria-label="Carregando ofertas" className="space-y-4">
            <div className="h-6 w-44 rounded bg-[#161F18] animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {Array.from({ length: 8 }).map((_, idx) => (
                <SkeletonCard key={idx} />
              ))}
            </div>
          </section>
        ) : produtosVisiveis.length === 0 ? (
          <section
            id="secao-ofertas"
            className="rounded-2xl border border-dashed border-[#1E2A20] bg-[#0C120D] py-16 px-6 text-center space-y-3"
          >
            <h2 className="text-lg font-semibold text-white">Nenhuma oferta encontrada</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {temFiltroAtivo
                ? 'Tente ajustar sua busca ou escolher outra categoria ou loja para ver mais produtos.'
                : 'Ainda não há ofertas ativas publicadas no momento.'}
            </p>
            {temFiltroAtivo && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={resetarFiltros}
                  className="px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-9">
            {destaques.length > 0 && (
              <section
                id="secao-destaques"
                aria-labelledby="titulo-destaques"
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="w-1 h-5 rounded-full bg-[#22C55E] shrink-0"
                    />
                    <h2
                      id="titulo-destaques"
                      className="text-lg sm:text-xl font-bold tracking-tight text-white"
                    >
                      Produtos em destaque
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                    {destaques.length} {destaques.length === 1 ? 'destaque' : 'destaques'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {destaques.map((produto) => (
                    <CardProduto
                      key={`destaque-${produto.id}`}
                      produto={produto}
                      onAbrirDetalhes={(id) => onNavigate(`/p/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {(demaisOfertas.length > 0 || temMais || temFiltroAtivo) && (
              <section
                id="secao-ofertas"
                aria-labelledby="titulo-todas-ofertas"
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="w-1 h-5 rounded-full bg-[#22C55E] shrink-0"
                    />
                    <h2
                      id="titulo-todas-ofertas"
                      className="text-lg sm:text-xl font-bold tracking-tight text-white"
                    >
                      {tituloSecaoOfertas}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    {temFiltroAtivo && (
                      <button
                        type="button"
                        onClick={resetarFiltros}
                        className="text-xs font-semibold text-[#22C55E] hover:text-[#4ADE80] cursor-pointer whitespace-nowrap"
                      >
                        Limpar filtros
                      </button>
                    )}
                    <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {demaisOfertas.length}{' '}
                      {demaisOfertas.length === 1 ? 'produto' : 'produtos'}
                    </span>
                  </div>
                </div>

                {demaisOfertas.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                    {demaisOfertas.map((produto) => (
                      <CardProduto
                        key={produto.id}
                        produto={produto}
                        onAbrirDetalhes={(id) => onNavigate(`/p/${id}`)}
                      />
                    ))}
                  </div>
                )}

                {temMais && (
                  <div className="pt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void carregarMaisOfertas()}
                      disabled={carregandoMais}
                      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-lg border border-[#22C55E]/40 bg-[#0F1410] hover:bg-[#172319] text-sm font-semibold text-[#22C55E] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {carregandoMais && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{carregandoMais ? 'Carregando...' : 'Carregar mais'}</span>
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* Faixa de benefícios / confiança */}
        <section
          aria-label="Como funciona"
          className="rounded-2xl border border-[#1B2A1E] bg-[#0B120C] px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-0 md:divide-x md:divide-[#1B2A1E]"
        >
          <div className="flex items-start gap-4 md:pr-8">
            <div className="w-11 h-11 rounded-xl bg-[#102214] border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-white">
                Redirecionamento seguro
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Você é levado diretamente para o site oficial da loja, com toda a segurança e
                praticidade.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 md:pl-8">
            <div className="w-11 h-11 rounded-xl bg-[#102214] border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-white">
                As melhores lojas
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Produtos selecionados de{' '}
                {PLATAFORMAS_PRINCIPAIS_VITRINE.map((id) => PLATAFORMAS_CONFIG[id].nome).join(', ')}{' '}
                e outras plataformas.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé enxuto */}
      <footer className="border-t border-[#1A261C] bg-[#080C09] mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <BrandLogo tamanho="sm" />
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Os preços e a disponibilidade podem mudar a qualquer momento nos sites das lojas.
              Este site pode receber comissão por compras feitas pelos links.
            </p>
            <p className="inline-flex items-start sm:items-center gap-1.5 text-xs text-slate-300 leading-relaxed">
              <BadgeCheck
                className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <span>
                Afiliado cadastrado da{' '}
                <strong className="font-semibold text-white">Shopee</strong>,{' '}
                <strong className="font-semibold text-white">Mercado Livre</strong> e{' '}
                <strong className="font-semibold text-white">TikTok Shop</strong>.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs text-slate-400 shrink-0">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hover:text-[#22C55E] transition-colors cursor-pointer"
            >
              Voltar ao topo
            </button>
            <a
              href={comBasePath('/admin', import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className="hover:text-[#22C55E] transition-colors inline-block"
            >
              Painel ADM
            </a>
          </div>
        </div>

        <div className="border-t border-[#141E16]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 text-center text-xs text-slate-400">
            <span className="text-[#22C55E] font-semibold">Achadinhos do Deco</span> — Vitrine
            online de ofertas e promoções.
          </div>
        </div>
      </footer>
    </div>
  );
}
