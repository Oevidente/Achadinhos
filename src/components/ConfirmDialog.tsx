import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  descricao: string;
  confirmarTexto?: string;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  confirmarTexto = 'Excluir',
  carregando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  if (!aberto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-[#1E2A20] bg-[#0F1410] p-6 space-y-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-white">
              {titulo}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">{descricao}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={carregando}
            className="px-4 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#161E17] text-sm font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {carregando ? 'Excluindo...' : confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}
