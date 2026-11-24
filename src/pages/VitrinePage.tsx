import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flame,
  LayoutGrid,
  Loader2,
  Percent,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { CardProduto } from '../components/CardProduto';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { listarProdutosAtivosPaginado } from '../services/produtosService';
import type { Plataforma, Produto } from '../types/produto';
import { PLATAFORMAS_CONFIG } from '../utils/plataformas';
import { comBasePath } from '../utils/router';
import {
  filtrarEOrdenarVitrine,
  obterPlataformasFiltro,
  type OrdenacaoVitrine,
} from '../utils/vitrineHelpers';

interface VitrinePageProps {
  onNavigate: (path: string) => void;
}

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

  const produtosVisiveis = useMemo(
    () =>
      filtrarEOrdenarVitrine(produtos, {
        busca,
        plataforma: plataformaSelecionada,
        ordenacao,
      }),
    [produtos, busca, plataformaSelecionada, ordenacao]
  );

  const destaques = useMemo(
    () => produtosVisiveis.filter((produto) => produto.destaque),
    [produtosVisiveis]
  );

  const temFiltroAtivo = busca.trim() !== '' || plataformaSelecionada !== 'todas';

  const rolarParaSecao = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selecionarPlataformaERolar = (plat: 'todas' | Plataforma) => {
    setPlataformaSelecionada(plat);
    rolarParaSecao('secao-ofertas');
  };

  const resetarFiltros = () => {
    setBusca('');
    setPlataformaSelecionada('todas');
    setOrdenacao('mais_recentes');
  };

  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex flex-col">
      {/* Cabeçalho principal estilo storefront neon verde */}
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
              placeholder="O que você procura?"
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

          <div className="hidden lg:flex items-center gap-4 text-xs text-slate-300 shrink-0">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Zap className="w-4 h-4 text-[#22C55E]" />
              <span>Acesso rápido às lojas</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
              <span>Links verificados</span>
            </span>
            <PWAInstallButton />
          </div>
        </div>

        {/* Sub-barra de filtros de plataforma */}
        <div className="border-t border-[#141E16] bg-[#070B08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
            <div
              role="group"
              aria-label="Filtrar por plataforma"
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 pr-4 sm:pr-0 [mask-image:linear-gradient(to_right,black_92%,transparent)] sm:[mask-image:none]"
            >
              <button
                type="button"
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-9">
        {/* Banner Hero Neon Verde */}
        <section
          aria-label="Apresentação da vitrine"
          className="relative overflow-hidden rounded-2xl border border-[#1E2F21] bg-gradient-to-br from-[#0B140D] via-[#09120B] to-[#0E2B14] px-6 py-8 sm:px-10 sm:py-11"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#22C55E]/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-10 bottom-0 w-56 h-56 rounded-full bg-[#22C55E]/15 blur-2xl"
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4 max-w-xl">
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.12]">
                Encontre tudo o que{' '}
                <span className="text-[#22C55E] block sm:inline">você precisa</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Ofertas selecionadas e conferidas das melhores lojas, reunidas em um só lugar com
                redirecionamento direto.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => rolarParaSecao('secao-ofertas')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#22C55E]/70 bg-[#0D1E11]/90 hover:bg-[#22C55E] text-[#4ADE80] hover:text-[#052E16] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Explorar ofertas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="hidden lg:flex lg:col-span-5 justify-end">
              <div className="w-full max-w-sm rounded-2xl border border-[#22C55E]/25 bg-[#070D08]/80 p-5 space-y-3.5 shadow-[0_0_40px_rgba(34,197,94,0.12)]">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>Curadoria de promoções</span>
                  <span className="text-[#22C55E] font-semibold tabular-nums">
                    {produtosVisiveis.length}{' '}
                    {produtosVisiveis.length === 1 ? 'oferta ativa' : 'ofertas ativas'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOrdenacao('maior_desconto');
                      rolarParaSecao('secao-ofertas');
                    }}
                    className="rounded-xl border border-[#1E2A20] bg-[#0B120C] hover:border-[#22C55E]/50 p-3 text-left space-y-1 transition-colors cursor-pointer"
                  >
                    <Percent className="w-4 h-4 text-[#22C55E]" />
                    <p className="font-semibold text-white">Maior desconto</p>
                    <p className="text-[11px] text-slate-400">Ver quedas de preço</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrdenacao('menor_preco');
                      rolarParaSecao('secao-ofertas');
                    }}
                    className="rounded-xl border border-[#1E2A20] bg-[#0B120C] hover:border-[#22C55E]/50 p-3 text-left space-y-1 transition-colors cursor-pointer"
                  >
                    <Tag className="w-4 h-4 text-[#22C55E]" />
                    <p className="font-semibold text-white">Menor preço</p>
                    <p className="text-[11px] text-slate-400">Achadinhos em conta</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Faixa de atalhos circulares (estilo categorias da referência) */}
        <section aria-label="Atalhos rápidos" className="overflow-x-auto no-scrollbar py-1">
          <div className="flex items-start justify-start sm:justify-between gap-4 sm:gap-5 min-w-max sm:min-w-0">
            {[
              {
                id: 'todas',
                titulo: 'Todas',
                ativo: plataformaSelecionada === 'todas' && ordenacao === 'mais_recentes',
                icon: LayoutGrid,
                onClick: () => {
                  setPlataformaSelecionada('todas');
                  setOrdenacao('mais_recentes');
                },
              },
              {
                id: 'maior_desconto',
                titulo: 'Descontos',
                ativo: ordenacao === 'maior_desconto',
                icon: Percent,
                onClick: () => {
                  setOrdenacao('maior_desconto');
                  rolarParaSecao('secao-ofertas');
                },
              },
              {
                id: 'menor_preco',
                titulo: 'Menor preço',
                ativo: ordenacao === 'menor_preco',
                icon: Tag,
                onClick: () => {
                  setOrdenacao('menor_preco');
                  rolarParaSecao('secao-ofertas');
                },
              },
              {
                id: 'destaques',
                titulo: 'Destaques',
                ativo: false,
                icon: Flame,
                onClick: () =>
                  rolarParaSecao(destaques.length > 0 ? 'secao-destaques' : 'secao-ofertas'),
              },
              ...plataformasChips.slice(0, 3).map((platId) => ({
                id: platId,
                titulo: PLATAFORMAS_CONFIG[platId].nome,
                ativo: plataformaSelecionada === platId,
                icon: ExternalLink,
                onClick: () => selecionarPlataformaERolar(platId),
              })),
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="group flex flex-col items-center gap-2 w-20 shrink-0 cursor-pointer"
                >
                  <span
                    className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all ${
                      item.ativo
                        ? 'border-[#22C55E] bg-[#102415] text-[#22C55E] shadow-[0_0_18px_rgba(34,197,94,0.22)]'
                        : 'border-[#1E2A20] bg-[#0D130E] text-[#4ADE80] group-hover:border-[#22C55E]/70 group-hover:bg-[#111E14]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white text-center whitespace-nowrap">
                    {item.titulo}
                  </span>
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
                ? 'Tente ajustar sua busca ou selecionar outra loja para ver mais produtos.'
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
          <div className="space-y-10">
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
                  <button
                    type="button"
                    onClick={() => rolarParaSecao('secao-ofertas')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#22C55E] hover:text-[#4ADE80] cursor-pointer whitespace-nowrap"
                  >
                    <span>Ver todos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
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

            <section
              id="secao-ofertas"
              aria-labelledby="titulo-todas-ofertas"
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="w-1 h-5 rounded-full bg-[#22C55E] shrink-0"
                  />
                  <h2
                    id="titulo-todas-ofertas"
                    className="text-lg sm:text-xl font-bold tracking-tight text-white"
                  >
                    Ofertas em promoção
                  </h2>
                </div>
                <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                  {produtosVisiveis.length}{' '}
                  {produtosVisiveis.length === 1 ? 'produto' : 'produtos'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                {produtosVisiveis.map((produto) => (
                  <CardProduto
                    key={produto.id}
                    produto={produto}
                    onAbrirDetalhes={(id) => onNavigate(`/p/${id}`)}
                  />
                ))}
              </div>

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
          </div>
        )}

        {/* Faixa de benefícios / confiança (igual à referência) */}
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
                Produtos selecionados de Shopee, Mercado Livre, Amazon, TikTok Shop, Magalu e
                outras plataformas.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé estruturado estilo storefront */}
      <footer className="border-t border-[#1A261C] bg-[#080C09] mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-3">
            <BrandLogo tamanho="sm" />
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Os preços e a disponibilidade podem mudar a qualquer momento nos sites das lojas.
              Este site pode receber comissão por compras feitas pelos links.
            </p>
          </div>

          <div className="lg:col-span-4 space-y-2.5">
            <h3 className="text-xs font-bold text-white">Lojas</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400">
              {plataformasChips.slice(0, 6).map((platId) => (
                <li key={platId}>
                  <button
                    type="button"
                    onClick={() => selecionarPlataformaERolar(platId)}
                    className="hover:text-[#22C55E] transition-colors cursor-pointer text-left"
                  >
                    {PLATAFORMAS_CONFIG[platId].nome}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-2.5">
            <h3 className="text-xs font-bold text-white">Acesso</h3>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-[#22C55E] transition-colors cursor-pointer"
                >
                  Voltar ao topo
                </button>
              </li>
              <li>
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
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#141E16]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
            <span className="text-[#22C55E] font-semibold">Achadinhos do Deco</span> — Vitrine
            online de ofertas e promoções.
          </div>
        </div>
      </footer>
    </div>
  );
}
