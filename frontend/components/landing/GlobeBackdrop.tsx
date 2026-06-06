// Static decorative globe backdrop. No movement — only a fixed dotted world map
// inside a soft sphere with a purple-to-orange arc and ambient glow.

// Low-res equirectangular sketch of the continents. Each '#' becomes a dot.
// Left cluster = Americas, center = Europe/Africa, right = Asia/Australia.
const WORLD_MAP = [
  '                                                            ',
  '      ####         ####           ########    ##           ',
  '    ########      #####         #########    ####  ##       ',
  '   ##########    ####          ###########  ########        ',
  '   ###########  ####     ###   ###########  #########  ##   ',
  '    ##########          #####   #########   ##########      ',
  '      ########           ###     #######    ###########     ',
  '        ######            #       #####      #########  ##  ',
  '         #####                     ####       #######   ### ',
  '          ###                       ###        #####   #### ',
  '           ##           ##          ####         ###   ###  ',
  '            #          ####         ####          ##        ',
  '                       #####         ###                    ',
  '                        ####         ###          ##        ',
  '                        ####         ###         #####      ',
  '                         ###          ##          ###       ',
  '                          ##          ##                    ',
  '                          ###         ##                    ',
  '                           ##         #                     ',
  '                           ##                               ',
  '                            #                               ',
  '                                                            ',
]

const COLS = 60
const ROWS = WORLD_MAP.length

function WorldMapDots() {
  const dots: JSX.Element[] = []
  const xStart = 168
  const xSpan = 624
  const yStart = 78
  const ySpan = 556

  for (let r = 0; r < ROWS; r++) {
    const row = WORLD_MAP[r]
    for (let c = 0; c < COLS; c++) {
      if (row[c] === '#') {
        const x = xStart + (c / (COLS - 1)) * xSpan
        const y = yStart + (r / (ROWS - 1)) * ySpan
        dots.push(
          <circle key={`${r}-${c}`} cx={x} cy={y} r={1.45} fill="#C7C7E6" fillOpacity={0.5} />
        )
      }
    }
  }
  return <g>{dots}</g>
}

function DotField({ className }: { className: string }) {
  const id = `df-${className.replace(/[^a-z]/gi, '')}`
  return (
    <svg
      width={220}
      height={220}
      viewBox="0 0 220 220"
      className={`absolute opacity-40 ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill="currentColor" fillOpacity="0.5" />
        </pattern>
      </defs>
      <rect width="220" height="220" fill={`url(#${id})`} />
    </svg>
  )
}

function WaveField({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      className={`pointer-events-none absolute bottom-0 hidden h-[420px] w-[460px] opacity-[0.18] lg:block ${
        side === 'left' ? 'left-0' : 'right-0 scale-x-[-1]'
      }`}
      viewBox="0 0 460 420"
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <path
          key={i}
          d={`M-20 ${300 + i * 18} C 120 ${240 + i * 18}, 260 ${360 + i * 18}, 480 ${280 + i * 18}`}
          stroke={side === 'left' ? '#673BFF' : '#FF6A2A'}
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}

export function GlobeBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(38% 45% at 14% 54%, rgba(109,53,255,0.18), transparent 74%),' +
            'radial-gradient(34% 42% at 88% 58%, rgba(255,106,42,0.18), transparent 76%),' +
            'radial-gradient(48% 40% at 52% 8%, rgba(124,58,237,0.16), transparent 72%)',
        }}
      />

      <DotField className="left-0 bottom-20 text-[#673BFF]" />
      <DotField className="right-0 top-80 text-[#FF6A2A]" />
      <WaveField side="left" />
      <WaveField side="right" />

      {/* Desktop globe */}
      <div className="absolute left-1/2 top-[102px] hidden -translate-x-1/2 lg:block">
        <svg
          width={960}
          height={690}
          viewBox="0 0 960 690"
          className="h-auto w-[800px] opacity-[0.92]"
          role="presentation"
        >
          <defs>
            <radialGradient id="heroGlobeFill" cx="50%" cy="38%" r="62%">
              <stop offset="0%" stopColor="#111947" stopOpacity="0.62" />
              <stop offset="62%" stopColor="#0B1026" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#050817" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="heroArcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="46%" stopColor="#B84DFF" />
              <stop offset="100%" stopColor="#FF6A2A" />
            </linearGradient>
            <pattern id="heroDotGrid" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1.3" cy="1.3" r="0.75" fill="#B8B8D6" fillOpacity="0.28" />
            </pattern>
            <clipPath id="heroSphereClip">
              <circle cx="480" cy="356" r="326" />
            </clipPath>
          </defs>

          <circle cx="480" cy="356" r="326" fill="url(#heroGlobeFill)" />
          <g clipPath="url(#heroSphereClip)" opacity="0.9">
            <rect x="154" y="30" width="652" height="652" fill="url(#heroDotGrid)" />
            <WorldMapDots />
          </g>

          <circle
            cx="480"
            cy="356"
            r="326"
            fill="none"
            stroke="url(#heroArcGradient)"
            strokeOpacity="0.76"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="480" cy="356" r="328" fill="none" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1" />
          <circle cx="188" cy="248" r="2.7" fill="#FF6A2A" filter="drop-shadow(0 0 8px #FF6A2A)" />
          <circle cx="690" cy="320" r="2.6" fill="#FF6A2A" filter="drop-shadow(0 0 8px #FF6A2A)" />
        </svg>
      </div>

      {/* Mobile / tablet globe */}
      <div className="absolute left-1/2 top-20 -translate-x-1/2 lg:hidden">
        <svg
          width={760}
          height={560}
          viewBox="0 0 960 690"
          className="h-auto w-[min(130vw,760px)] opacity-55"
          role="presentation"
        >
          <defs>
            <radialGradient id="heroGlobeFillMobile" cx="50%" cy="38%" r="62%">
              <stop offset="0%" stopColor="#111947" stopOpacity="0.62" />
              <stop offset="62%" stopColor="#0B1026" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#050817" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="heroArcGradientMobile" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="46%" stopColor="#B84DFF" />
              <stop offset="100%" stopColor="#FF6A2A" />
            </linearGradient>
            <pattern id="heroDotGridMobile" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1.3" cy="1.3" r="0.75" fill="#B8B8D6" fillOpacity="0.28" />
            </pattern>
            <clipPath id="heroSphereClipMobile">
              <circle cx="480" cy="356" r="326" />
            </clipPath>
          </defs>

          <circle cx="480" cy="356" r="326" fill="url(#heroGlobeFillMobile)" />
          <g clipPath="url(#heroSphereClipMobile)" opacity="0.9">
            <rect x="154" y="30" width="652" height="652" fill="url(#heroDotGridMobile)" />
            <WorldMapDots />
          </g>

          <circle
            cx="480"
            cy="356"
            r="326"
            fill="none"
            stroke="url(#heroArcGradientMobile)"
            strokeOpacity="0.7"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}
