import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Package,
  Star,
  Ticket,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { buscarProduto, registrarCliqueProduto } from '../services/produtosService';
import type { Plataforma, Produto } from '../types/produto';
import {
  calcularDescontoPercentual,
  formatarMoeda,
  formatarTempoRelativo,
  produtoEstaExpirado,
} from '../utils/adminHelpers';
import { PLATAFORMAS_CONFIG } from '../utils/plataformas';
import { comBasePath } from '../utils/router';
import { obterUrlDestinoOferta } from '../utils/vitrineHelpers';

interface ProdutoDetalhePageProps {
  produtoId: string;
  onNavigate: (path: string) => void;
  onToast: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

const TITULO_PADRAO = 'Achadinhos do Deco — Ofertas em Promoção';
const DESCRICAO_PADRAO =
  'Curadoria de ofertas e promoções dos principais marketplaces com redirecionamento direto e seguro.';

function corTextoPlataforma(plataforma: Plataforma): string {
  if (plataforma === 'mercado_livre' || plataforma === 'amazon' || plataforma === 'kabum') {
    return '#070A07';
  }
  return '#FFFFFF';
}

function atualizarMetaTag(seletor: string, conteudo: string) {
  const elemento = document.querySelector<HTMLMetaElement>(seletor);
  if (elemento) {
    elemento.setAttribute('content', conteudo);
  }
}

export function ProdutoDetalhePage({
  produtoId,
  onNavigate,
  onToast,
}: ProdutoDetalhePageProps) {
  const [produto, setProduto] = useState<Produto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [imgErro, setImgErro] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [cupomCopiado, setCupomCopiado] = useState(false);

  const carregarProduto = useCallback(async () => {
    setCarregando(true);
    setErroRede(null);
    setImgErro(false);
    try {
      const encontrado = await buscarProduto(produtoId);
      setProduto(encontrado);
    } catch (error) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (msg.includes('invalid') || msg.includes('inválido')) {
        setProduto(null);
      } else {
        setErroRede('Não foi possível carregar esta oferta no momento. Verifique sua conexão.');
      }
    } finally {
      setCarregando(false);
    }
  }, [produtoId]);

  useEffect(() => {
    void carregarProduto();
  }, [carregarProduto]);

  useEffect(() => {
    if (!produto) {
      document.title = TITULO_PADRAO;
      atualizarMetaTag('meta[name="description"]', DESCRICAO_PADRAO);
      atualizarMetaTag('meta[property="og:title"]', TITULO_PADRAO);
      atualizarMetaTag('meta[property="og:description"]', DESCRICAO_PADRAO);
      return;
    }

    const precoFmt = formatarMoeda(produto.precoAtual, produto.moeda);
    const plat = PLATAFORMAS_CONFIG[produto.plataforma] ?? PLATAFORMAS_CONFIG.outra;
    const tituloPagina = `${produto.titulo} (${precoFmt}) — Achadinhos do Deco`;
    const descPagina =
      produto.descricao.trim() ||
      `Oferta conferida em ${plat.nome} por ${precoFmt}. Veja no Achadinhos do Deco.`;

    document.title = tituloPagina;
    atualizarMetaTag('meta[name="description"]', descPagina);
    atualizarMetaTag('meta[property="og:title"]', `${produto.titulo} — ${precoFmt}`);
    atualizarMetaTag('meta[property="og:description"]', descPagina);
    if (produto.imagemUrl.trim()) {
      atualizarMetaTag('meta[property="og:image"]', produto.imagemUrl.trim());
    }

    const scriptId = 'produto-jsonld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: produto.titulo,
      description: descPagina,
      image: produto.imagemUrl.trim() || undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: produto.moeda || 'BRL',
        price: produto.precoAtual,
        availability:
          produto.status === 'ativo' && !produtoEstaExpirado(produto)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        url: window.location.href,
      },
    });

    return () => {
      document.title = TITULO_PADRAO;
      atualizarMetaTag('meta[name="description"]', DESCRICAO_PADRAO);
      atualizarMetaTag('meta[property="og:title"]', TITULO_PADRAO);
      atualizarMetaTag('meta[property="og:description"]', DESCRICAO_PADRAO);
      const existente = document.getElementById(scriptId);
      if (existente) existente.remove();
    };
  }, [produto]);

  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      onToast('sucesso', 'Link copiado! Pronto para compartilhar.');
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      onToast('erro', 'Não foi possível copiar o link automaticamente.');
    }
  };

  const handleCopiarCupom = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCupomCopiado(true);
      onToast('sucesso', `Cupom ${codigo} copiado! Cole no carrinho da loja.`);
      window.setTimeout(() => setCupomCopiado(false), 2500);
    } catch {
      onToast('erro', 'Não foi possível copiar o cupom automaticamente.');
    }
  };

  const indisponivel =
    produto !== null && (produto.status !== 'ativo' || produtoEstaExpirado(produto));

  const plat = produto
    ? PLATAFORMAS_CONFIG[produto.plataforma] ?? PLATAFORMAS_CONFIG.outra
    : PLATAFORMAS_CONFIG.outra;
  const precoValido = produto ? Number.isFinite(produto.precoAtual) && produto.precoAtual > 0 : false;
  const precoOriginalValido =
    produto !== null &&
    produto.precoOriginal !== null &&
    Number.isFinite(produto.precoOriginal) &&
    produto.precoOriginal > produto.precoAtual;
  const desconto =
    produto && precoValido && precoOriginalValido
      ? calcularDescontoPercentual(produto.precoAtual, produto.precoOriginal)
      : null;
  const tempoConferido = produto ? formatarTempoRelativo(produto.atualizadoEm) : '';
  const urlDestino = produto ? obterUrlDestinoOferta(produto) : '';

  return (
    <div className="min-h-screen bg-[#070A07] text-slate-100 flex flex-col">
      <header className="border-b border-[#1E2A20] bg-[#0B100C]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href={comBasePath('/', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center whitespace-nowrap shrink-0"
          >
            <BrandLogo tamanho="sm" />
          </a>

          <a
            href={comBasePath('/', import.meta.env.BASE_URL)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ver todas as ofertas</span>
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {carregando ? (
          <div className="rounded-2xl border border-[#1E2A20] bg-[#0F1410] p-6 grid grid-cols-1 md:grid-cols-12 gap-6 animate-pulse">
            <div className="md:col-span-5 aspect-square rounded-xl bg-[#161F18]" />
            <div className="md:col-span-7 space-y-4">
              <div className="h-5 w-28 rounded bg-[#161F18]" />
              <div className="h-8 w-4/5 rounded bg-[#161F18]" />
              <div className="h-10 w-40 rounded bg-[#161F18]" />
              <div className="h-20 w-full rounded bg-[#161F18]" />
              <div className="h-12 w-full rounded-xl bg-[#161F18]" />
            </div>
          </div>
        ) : erroRede ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-red-200"
          >
            <span>{erroRede}</span>
            <button
              type="button"
              onClick={() => void carregarProduto()}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-white cursor-pointer self-start"
            >
              Tentar novamente
            </button>
          </div>
        ) : !produto ? (
          <section className="rounded-2xl border border-[#1E2A20] bg-[#0F1410] py-14 px-6 text-center space-y-4">
            <h1 className="text-xl font-bold text-white">Oferta não encontrada</h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              O link acessado pode ter sido removido ou não existe mais no Achadinhos do Deco.
            </p>
            <div>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Explorar ofertas ativas</span>
              </button>
            </div>
          </section>
        ) : indisponivel ? (
          <section className="rounded-2xl border border-[#1E2A20] bg-[#0F1410] py-14 px-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white">{produto.titulo}</h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Esta oferta expirou ou foi pausada no momento. Confira outras promoções ativas na vitrine.
            </p>
            <div>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ver ofertas ativas</span>
              </button>
            </div>
          </section>
        ) : (
          <article className="rounded-2xl border border-[#1E2A20] bg-[#0F1410] p-5 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
            <div className="md:col-span-5">
              <div className="relative aspect-square rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-4">
                {produto.imagemUrl.trim() && !imgErro ? (
                  <img
                    src={produto.imagemUrl.trim()}
                    alt={produto.titulo}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErro(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Package className="w-12 h-12 stroke-[1.5]" />
                    <span className="text-xs">Sem imagem</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-bold"
                  style={{
                    backgroundColor: plat.corSelo,
                    color: corTextoPlataforma(produto.plataforma),
                  }}
                >
                  {plat.nome}
                </span>

                {produto.destaque && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#122616] border border-[#22C55E]/40 text-[#4ADE80] text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>Destaque</span>
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug">
                {produto.titulo}
              </h1>

              <div className="rounded-xl border border-[#1E2A20] bg-[#070A07] p-4 space-y-1.5">
                {precoOriginalValido && produto.precoOriginal !== null && (
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span className="text-slate-400 line-through">
                      {formatarMoeda(produto.precoOriginal, produto.moeda)}
                    </span>
                    {desconto !== null && (
                      <span className="px-2 py-0.5 rounded bg-[#122616] text-[#4ADE80] text-xs font-bold">
                        -{desconto}% OFF
                      </span>
                    )}
                  </div>
                )}

                <p className="text-3xl font-extrabold text-[#22C55E] tabular-nums">
                  {precoValido ? formatarMoeda(produto.precoAtual, produto.moeda) : 'Consulte na loja'}
                </p>

                {tempoConferido && (
                  <p className="text-xs text-slate-400">{tempoConferido}</p>
                )}
              </div>

              {produto.cupom && produto.cupom.trim() && (
                <div className="rounded-xl border border-dashed border-[#22C55E]/50 bg-[#0A170D] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#122616] border border-[#22C55E]/30 text-[#4ADE80] flex items-center justify-center shrink-0">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-400">Cupom de desconto</p>
                      <p className="font-mono text-base font-bold text-white truncate">
                        {produto.cupom.trim()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopiarCupom(produto.cupom!.trim())}
                    className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {cupomCopiado ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Cupom copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar cupom</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {produto.descricao.trim() && (
                <div className="space-y-1.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Sobre a oferta
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {produto.descricao.trim()}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={urlDestino}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => {
                    void registrarCliqueProduto(produto.id);
                  }}
                  className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <span>Ver oferta na {plat.nome}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </a>

                <button
                  type="button"
                  onClick={() => void handleCopiarLink()}
                  className="min-h-[48px] px-4 py-3 rounded-xl border border-[#1E2A20] bg-[#070A07] hover:bg-[#161F18] text-sm font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiado ? (
                    <>
                      <Check className="w-4 h-4 text-[#22C55E]" />
                      <span>Link copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>
        )}
      </main>

      <footer className="border-t border-[#1E2A20] bg-[#0B100C]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
