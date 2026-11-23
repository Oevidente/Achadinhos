import { comBasePath } from '../utils/router';

interface BrandLogoProps {
  tamanho?: 'sm' | 'md' | 'lg';
  mostrarTexto?: boolean;
  subtitulo?: string;
}

const TAMANHOS_ICONE = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-11 h-11 rounded-xl',
} as const;

export function BrandLogo({
  tamanho = 'md',
  mostrarTexto = true,
  subtitulo,
}: BrandLogoProps) {
  const logoSrc = comBasePath(
    '/assets/aistudio/Emblema_Neon_de_Busca_Circular_cd1f0c41.png',
    import.meta.env.BASE_URL
  );

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span
        className={`${TAMANHOS_ICONE[tamanho]} overflow-hidden border border-[#22C55E]/40 bg-[#051105] shadow-[0_0_20px_rgba(34,197,94,0.28)] flex items-center justify-center shrink-0`}
      >
        <img
          src={logoSrc}
          alt={mostrarTexto ? '' : 'Logo Achadinhos do Deco'}
          aria-hidden={mostrarTexto ? true : undefined}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover scale-110"
        />
      </span>
      {mostrarTexto && (
        <span className="flex flex-col leading-tight">
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-white">
            Achadinhos do <span className="text-[#22C55E]">Deco</span>
          </span>
          {subtitulo && (
            <span className="text-[11px] font-medium text-slate-400">{subtitulo}</span>
          )}
        </span>
      )}
    </span>
  );
}
