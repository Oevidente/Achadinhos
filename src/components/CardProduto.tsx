import { useEffect, useState } from 'react';
import { ArrowRight, Package, Share2, Star } from 'lucide-react';
import { registrarCliqueProduto } from '../services/produtosService';
import type { Plataforma, Produto } from '../types/produto';
import {
  calcularDescontoPercentual,
  formatarMoeda,
  formatarTempoRelativo,
} from '../utils/adminHelpers';
import { PLATAFORMAS_CONFIG } from '../utils/plataformas';
import { comBasePath } from '../utils/router';
import { obterUrlDestinoOferta } from '../utils/vitrineHelpers';

export interface CardProdutoProps {
  produto: Pick<
    Produto,
    | 'titulo'
    | 'imagemUrl'
    | 'precoAtual'
    | 'precoOriginal'
    | 'moeda'
    | 'plataforma'
    | 'linkOriginal'
    | 'linkAfiliado'
    | 'destaque'
  > & {
    id?: string;
    atualizadoEm?: Produto['atualizadoEm'];
  };
  modoPreview?: boolean;
  onAbrirDetalhes?: (id: string) => void;
}

function corTextoPlataforma(plataforma: Plataforma): string {
  if (plataforma === 'mercado_livre' || plataforma === 'amazon' || plataforma === 'kabum') {
    return '#070A07';
  }
  return '#FFFFFF';
}

export function CardProduto({
  produto,
  modoPreview = false,
  onAbrirDetalhes,
}: CardProdutoProps) {
  const [imgErro, setImgErro] = useState(false);

  useEffect(() => {
    setImgErro(false);
  }, [produto.imagemUrl]);

  const plat = PLATAFORMAS_CONFIG[produto.plataforma] ?? PLATAFORMAS_CONFIG.outra;
  const precoValido = Number.isFinite(produto.precoAtual) && produto.precoAtual > 0;
  const precoOriginalValido =
    produto.precoOriginal !== null &&
    Number.isFinite(produto.precoOriginal) &&
    produto.precoOriginal > produto.precoAtual;

  const desconto =
    precoValido && precoOriginalValido
      ? calcularDescontoPercentual(produto.precoAtual, produto.precoOriginal)
      : null;

  const urlDestino = obterUrlDestinoOferta(produto);
  const tempoConferido = formatarTempoRelativo(produto.atualizadoEm ?? null);
  const podeAbrirDetalhes = !modoPreview && Boolean(produto.id) && Boolean(onAbrirDetalhes);

  const handleVerOfertaClick = () => {
    if (!modoPreview && produto.id) {
      void registrarCliqueProduto(produto.id);
    }
  };

  const imagemConteudo = (
    <>
      {produto.imagemUrl.trim() && !imgErro ? (
        <img
          src={produto.imagemUrl.trim()}
          alt={produto.titulo.trim() || 'Imagem do produto'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgErro(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="w-full h-full rounded-md bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-500 px-3 text-center">
          <Package className="w-8 h-8 sm:w-9 sm:h-9 stroke-[1.5]" />
          <span className="text-[11px] leading-tight">Sem imagem</span>
        </div>
      )}
    </>
  );

  return (
    <article className="rounded-xl bg-[#F8FAFC] text-slate-900 p-2.5 sm:p-3.5 border border-slate-200 flex flex-col justify-between gap-3 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="space-y-2.5 sm:space-y-3">
        <div className="relative aspect-square rounded-lg bg-white border border-slate-100 overflow-hidden flex items-center justify-center p-2.5">
          {podeAbrirDetalhes && produto.id ? (
            <a
              href={comBasePath(`/p/${produto.id}`, import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                onAbrirDetalhes?.(produto.id!);
              }}
              aria-label={`Ver detalhes de ${produto.titulo.trim() || 'produto'}`}
              className="w-full h-full flex items-center justify-center"
            >
              {imagemConteudo}
            </a>
          ) : (
            imagemConteudo
          )}

          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold tracking-tight shadow-xs pointer-events-none"
            style={{
              backgroundColor: plat.corSelo,
              color: corTextoPlataforma(produto.plataforma),
            }}
          >
            {plat.nome}
          </span>

          {produto.destaque && (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-[#22C55E] text-[10px] sm:text-[11px] font-bold pointer-events-none">
              <Star className="w-3 h-3 fill-current shrink-0" />
              <span>Destaque</span>
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem]">
            {podeAbrirDetalhes && produto.id ? (
              <a
                href={comBasePath(`/p/${produto.id}`, import.meta.env.BASE_URL)}
                onClick={(e) => {
                  e.preventDefault();
                  onAbrirDetalhes?.(produto.id!);
                }}
                className="hover:underline"
              >
                {produto.titulo.trim() || 'Título do produto'}
              </a>
            ) : (
              produto.titulo.trim() || 'Título do produto'
            )}
          </h3>

          <div className="space-y-0.5">
            {precoOriginalValido && produto.precoOriginal !== null && (
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs tabular-nums">
                <span className="text-slate-600 line-through">
                  {formatarMoeda(produto.precoOriginal, produto.moeda)}
                </span>
                {desconto !== null && (
                  <span className="font-bold text-[#15803D]">-{desconto}%</span>
                )}
              </div>
            )}

            <p className="text-base sm:text-xl font-extrabold text-slate-950 tabular-nums leading-tight">
              {precoValido
                ? formatarMoeda(produto.precoAtual, produto.moeda)
                : 'R$ 0,00'}
            </p>

            {tempoConferido && (
              <p className="text-[11px] text-slate-600 leading-tight pt-0.5">
                {tempoConferido}
              </p>
            )}
          </div>
        </div>
      </div>

      {modoPreview || !urlDestino.trim() ? (
        <span className="w-full min-h-[40px] py-2 px-3 rounded-lg bg-[#22C55E] text-[#052E16] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 select-none">
          <span>Ver oferta</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          <a
            href={urlDestino}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleVerOfertaClick}
            className="flex-1 min-h-[40px] py-2 px-3 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>Ver oferta</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </a>

          {podeAbrirDetalhes && produto.id && (
            <a
              href={comBasePath(`/p/${produto.id}`, import.meta.env.BASE_URL)}
              onClick={(e) => {
                e.preventDefault();
                onAbrirDetalhes?.(produto.id!);
              }}
              title="Ver detalhes e compartilhar"
              aria-label={`Ver detalhes e compartilhar ${produto.titulo.trim() || 'produto'}`}
              className="w-10 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}
