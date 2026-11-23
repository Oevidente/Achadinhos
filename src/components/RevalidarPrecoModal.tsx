import { AlertTriangle, ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';
import type { Produto } from '../types/produto';
import type { ExtratorResultado } from '../services/extratorService';
import { formatarMoeda } from '../utils/adminHelpers';
import { PLATAFORMAS_CONFIG } from '../utils/plataformas';

interface RevalidarPrecoModalProps {
  aberto: boolean;
  produto: Produto | null;
  extraido: ExtratorResultado | null;
  salvando: boolean;
  onConfirmar: (novoPreco: number) => void;
  onCancelar: () => void;
}

export function RevalidarPrecoModal({
  aberto,
  produto,
  extraido,
  salvando,
  onConfirmar,
  onCancelar,
}: RevalidarPrecoModalProps) {
  if (!aberto || !produto || !extraido) return null;

  const plat = PLATAFORMAS_CONFIG[produto.plataforma] ?? PLATAFORMAS_CONFIG.outra;
  const precoNovo = extraido.precoAtual;
  const precoNovoValido = precoNovo !== null && Number.isFinite(precoNovo) && precoNovo > 0;
  const diferenca = precoNovoValido ? precoNovo - produto.precoAtual : 0;
  const mesmaCoisa = precoNovoValido && Math.abs(diferenca) < 0.01;
  const precisaRevisao =
    extraido.confiancaPreco === 'baixa' || extraido.confiancaPreco === 'nao_encontrado';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revalidar-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#1E2A20] bg-[#0F1410] p-6 space-y-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 id="revalidar-modal-title" className="text-base font-semibold text-white">
              Conferência de preço
            </h2>
            <p className="text-xs text-slate-400">
              {plat.nome} · {produto.titulo}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
          <div className="rounded-lg border border-[#1E2A20] bg-[#070A07] p-4 space-y-1">
            <span className="text-xs font-medium text-slate-400">Preço atual (salvo)</span>
            <p className="text-lg font-bold text-slate-200 tabular-nums">
              {formatarMoeda(produto.precoAtual, produto.moeda)}
            </p>
          </div>

          <div className="rounded-lg border border-[#22C55E]/35 bg-[#09120B] p-4 space-y-1">
            <span className="text-xs font-medium text-slate-400">Preço encontrado agora</span>
            <p
              className={`text-lg font-bold tabular-nums ${
                precoNovoValido ? 'text-[#22C55E]' : 'text-red-400'
              }`}
            >
              {precoNovoValido
                ? formatarMoeda(precoNovo, produto.moeda)
                : 'Não encontrado'}
            </p>
          </div>
        </div>

        {precoNovoValido && (
          <div className="text-xs font-medium flex items-center gap-2 text-slate-300 tabular-nums">
            <ArrowRight className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
            {mesmaCoisa ? (
              <span>O preço permanece igual ao cadastrado.</span>
            ) : diferenca < 0 ? (
              <span className="text-[#4ADE80]">
                Baixou {formatarMoeda(Math.abs(diferenca), produto.moeda)} em relação ao preço salvo.
              </span>
            ) : (
              <span className="text-amber-300">
                Subiu {formatarMoeda(diferenca, produto.moeda)} em relação ao preço salvo.
              </span>
            )}
          </div>
        )}

        {precisaRevisao && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <span>
              {precoNovoValido
                ? 'A confiança da extração foi baixa. Confirme no site da loja antes de atualizar.'
                : 'Não foi possível localizar o preço automaticamente neste link. Atualize manualmente pelo formulário se necessário.'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1E2A20]">
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            className="px-4 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#161E17] text-sm font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => precoNovoValido && onConfirmar(precoNovo)}
            disabled={salvando || !precoNovoValido}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-sm font-bold text-[#052E16] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>
              {salvando
                ? 'Atualizando...'
                : mesmaCoisa
                ? 'Confirmar conferência'
                : 'Atualizar preço'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
