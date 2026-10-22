import { useId } from 'react'

/** Glifo de OmniRoute (licencia MIT, github.com/diegosouzapw/OmniRoute): un nodo central unido a seis nodos. Recreado como componente, sin copiar archivos. */
export function OmniLogo({ size = 14 }: { size?: number }) {
  // un id por instancia: varios logos en la misma pagina no comparten el degradado
  const gradient = useId()
  return (
    <svg className="omni-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E54D5E" />
          <stop offset="1" stopColor="#C93D4E" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="6" fill={`url(#${gradient})`} />
      <g stroke="#fff" strokeWidth="1.2" strokeLinecap="round">
        <path d="M16 13 8 8M16 13 24 8M16 19 8 24M16 19 24 24M16 13V5M16 19V27" />
      </g>
      <g fill="#fff">
        <circle cx="16" cy="16" r="3" />
        <circle cx="8" cy="8" r="2" />
        <circle cx="24" cy="8" r="2" />
        <circle cx="8" cy="24" r="2" />
        <circle cx="24" cy="24" r="2" />
        <circle cx="16" cy="5" r="1.5" />
        <circle cx="16" cy="27" r="1.5" />
      </g>
    </svg>
  )
}
