import { ArrowUpRight } from 'lucide-react';
import { APP_CONFIG } from '../config';

interface WhatsAppBannerProps {
  className?: string;
}

function WhatsAppIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.04 2C6.51 2 2.02 6.49 2.02 12.02c0 1.97.57 3.89 1.65 5.53L2.5 21.8l4.38-1.15a9.98 9.98 0 0 0 5.16 1.43h.01c5.53 0 10.02-4.49 10.02-10.02C22.07 6.49 17.57 2 12.04 2Zm5.83 14.16c-.25.7-1.45 1.34-2 1.42-.51.08-1.15.11-1.85-.11-.43-.14-.98-.32-1.69-.63-2.98-1.29-4.92-4.31-5.07-4.51-.15-.2-1.21-1.61-1.21-3.07 0-1.46.76-2.18 1.03-2.48.27-.3.59-.38.79-.38.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.85 2.07.92 2.22.08.15.13.33.02.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.54-.15.15-.31.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.15 1.37 2.45 1.52.3.15.48.13.66-.08.18-.2.75-.88.95-1.18.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.08.12.08.73-.17 1.43Z" />
    </svg>
  );
}

export function WhatsAppBanner({ className = '' }: WhatsAppBannerProps) {
  return (
    <section
      aria-label="Grupo de ofertas no WhatsApp"
      className={`relative overflow-hidden rounded-2xl border border-[#25D366]/35 bg-gradient-to-r from-[#0A180E] via-[#0C2113] to-[#09140C] px-4 py-4 sm:px-6 sm:py-4.5 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -bottom-10 w-44 h-44 rounded-full bg-[#25D366]/12 blur-2xl"
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#25D366]/15 border border-[#25D366]/40 text-[#25D366] flex items-center justify-center shrink-0">
            <WhatsAppIcon className="w-6 h-6" />
          </div>

          <div className="space-y-0.5 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white leading-snug">
              Grupo de Ofertas no WhatsApp
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Receba promoções, quedas de preço e cupons selecionados direto no seu celular.
            </p>
          </div>
        </div>

        <a
          href={APP_CONFIG.whatsappGrupoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Entrar no grupo de ofertas do WhatsApp"
          className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-[#052E16] font-extrabold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(37,211,102,0.18)]"
        >
          <WhatsAppIcon className="w-4 h-4 shrink-0" />
          <span>Entrar no grupo</span>
          <ArrowUpRight className="w-4 h-4 shrink-0" />
        </a>
      </div>
    </section>
  );
}
