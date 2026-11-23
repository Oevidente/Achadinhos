import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Loader2, Search, ShoppingBag, X } from 'lucide-react';
import { CardProduto } from '../components/CardProduto';
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
      setErro('Não foi possível carregar as ofertas no momento. Verifique sua conexão e tente novamente.');
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

  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex flex-col">
      {/* Cabeçalho simples: nome do site e busca por texto */}
      <header className="border-b border-[#1E2A20] bg-[#0B100C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
          <a
            href={comBasePath('/', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              setBusca('');
              setPlataformaSelecionada('todas');
              setOrdenacao('mais_recentes');
            }}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <span className="w-8 h-8 rounded-lg bg-[#22C55E] text-[#052E16] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight text-white">
              Achadinhos Hub
            </span>
          </a>

          <div className="relative w-full sm:max-w-md">
            <label htmlFor="vitrine-busca" className="sr-only">
              Buscar ofertas
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="vitrine-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="O que você procura?"
              className="w-full min-h-[42px] rounded-lg border border-[#1E2A20] bg-[#070A07] pl-10 pr-9 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-7">
        {/* Faixa de filtros por plataforma + ordenação */}
        <section aria-label="Filtros e ordenação" className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div
              role="group"
              aria-label="Filtrar por plataforma"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              <button
                type="button"
                onClick={() => setPlataformaSelecionada('todas')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  plataformaSelecionada === 'todas'
                    ? 'bg-[#22C55E] text-[#052E16]'
                    : 'bg-[#0F1410] border border-[#1E2A20] text-slate-300 hover:text-white hover:border-[#2C3D2F]'
                }`}
              >
                Todas
              </button>

              {plataformasChips.map((platId) => {
                const config = PLATAFORMAS_CONFIG[platId];
                const ativa = plataformaSelecionada === platId;
                return (
                  <button
                    key={platId}
                    type="button"
                    onClick={() => setPlataformaSelecionada(platId)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      ativa
                        ? 'bg-[#22C55E] text-[#052E16]'
                        : 'bg-[#0F1410] border border-[#1E2A20] text-slate-300 hover:text-white hover:border-[#2C3D2F]'
                    }`}
                  >
                    {config.nome}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <label htmlFor="vitrine-ordenacao" className="text-xs text-slate-400 whitespace-nowrap">
                Ordenar por
              </label>
              <select
                id="vitrine-ordenacao"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as OrdenacaoVitrine)}
                className="min-h-[38px] rounded-lg border border-[#1E2A20] bg-[#0F1410] px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="mais_recentes">Mais recentes</option>
                <option value="menor_preco">Menor preço</option>
                <option value="maior_desconto">Maior desconto</option>
              </select>
            </div>
          </div>
        </section>

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
            <div className="h-6 w-40 rounded bg-[#161F18] animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {Array.from({ length: 8 }).map((_, idx) => (
                <SkeletonCard key={idx} />
              ))}
            </div>
          </section>
        ) : produtosVisiveis.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#1E2A20] bg-[#0F1410] py-16 px-6 text-center space-y-3">
            <h1 className="text-lg font-semibold text-white">Nenhuma oferta encontrada</h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {temFiltroAtivo
                ? 'Tente ajustar sua busca ou selecionar outra loja para ver mais produtos.'
                : 'Ainda não há ofertas ativas publicadas no momento.'}
            </p>
            {temFiltroAtivo && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setBusca('');
                    setPlataformaSelecionada('todas');
                  }}
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
              <section aria-labelledby="titulo-destaques" className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h2
                    id="titulo-destaques"
                    className="text-lg sm:text-xl font-bold tracking-tight text-white"
                  >
                    Destaques
                  </h2>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {destaques.length}{' '}
                    {destaques.length === 1 ? 'oferta' : 'ofertas'}
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

            <section aria-labelledby="titulo-todas-ofertas" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h1
                  id="titulo-todas-ofertas"
                  className="text-lg sm:text-xl font-bold tracking-tight text-white"
                >
                  Ofertas em promoção
                </h1>
                <span className="text-xs text-slate-400 tabular-nums">
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
      </main>

      <footer className="border-t border-[#1E2A20] bg-[#0B100C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            Os preços e a disponibilidade podem mudar a qualquer momento nos sites das lojas.
            Este site pode receber comissão por compras feitas pelos links.
          </p>

          <a
            href={comBasePath('/admin', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/admin');
            }}
            className="text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Painel ADM
          </a>
        </div>
      </footer>
    </div>
  );
}
