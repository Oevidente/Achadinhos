import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [mostrarGuiaIOS, setMostrarGuiaIOS] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-[#22C55E]/50 bg-[#102415] hover:bg-[#17331E] text-xs font-semibold text-[#86EFAC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMostrarGuiaIOS(true)}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-[#22C55E]/40 bg-[#102415] hover:bg-[#17331E] text-xs font-semibold text-[#86EFAC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Instalar app</span>
        </button>

        {mostrarGuiaIOS && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-xl border border-[#1E2A20] bg-[#0F1410] p-5 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h2 id="pwa-ios-title" className="text-base font-bold text-white">
                  Instalar no iPhone ou iPad
                </h2>
                <button
                  type="button"
                  onClick={() => setMostrarGuiaIOS(false)}
                  aria-label="Fechar instruções"
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
                <li>
                  Toque no botão <strong className="text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Compartilhar</strong> na barra do Safari.
                </li>
                <li>
                  Role para baixo e toque em <strong className="text-white">Adicionar à Tela de Início</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setMostrarGuiaIOS(false)}
                className="w-full py-2.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-sm font-bold text-[#052E16] cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
