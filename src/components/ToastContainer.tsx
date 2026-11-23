import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  tipo: 'sucesso' | 'erro';
  mensagem: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)]"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.tipo === 'sucesso';
        return (
          <div
            key={toast.id}
            role={isSuccess ? 'status' : 'alert'}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
              isSuccess
                ? 'border-[#22C55E]/40 bg-[#0F1710]/95 text-slate-100'
                : 'border-red-500/40 bg-[#1A0F10]/95 text-red-100'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <p className="text-sm leading-snug flex-1">{toast.mensagem}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fechar notificação"
              className="text-slate-400 hover:text-white transition-colors p-0.5 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
