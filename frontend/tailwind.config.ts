import type { Config } from 'tailwindcss'

const withOpacity = (variableName: string) =>
  `color-mix(in oklab, var(${variableName}) calc(<alpha-value> * 100%), transparent)`

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: withOpacity('--border'),
        input: withOpacity('--input'),
        ring: withOpacity('--ring'),
        background: withOpacity('--background'),
        foreground: withOpacity('--foreground'),
        primary: {
          DEFAULT: withOpacity('--primary'),
          foreground: withOpacity('--primary-foreground'),
        },
        secondary: {
          DEFAULT: withOpacity('--secondary'),
          foreground: withOpacity('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: withOpacity('--destructive'),
          foreground: withOpacity('--destructive-foreground'),
        },
        muted: {
          DEFAULT: withOpacity('--muted'),
          foreground: withOpacity('--muted-foreground'),
        },
        accent: {
          DEFAULT: withOpacity('--accent'),
          foreground: withOpacity('--accent-foreground'),
          // Amber secondary — pairs with the orange brand ramp so the shared
          // `from-brand to-accent` gradients read as a warm orange→amber blend.
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          pink:   withOpacity('--accent-pink'),
          orange: withOpacity('--accent-orange'),
          amber:  withOpacity('--accent-amber'),
          green:  withOpacity('--accent-green'),
          lilac:  withOpacity('--accent-lilac'),
        },
        popover: {
          DEFAULT: withOpacity('--popover'),
          foreground: withOpacity('--popover-foreground'),
        },
        card: {
          DEFAULT: withOpacity('--card'),
          foreground: withOpacity('--card-foreground'),
        },
        // Orange brand ramp — unifies the app (dashboard/checker/tools) with the
        // marketing site, which is already built on #ff5a1f. 400 is the bright
        // on-dark text/icon shade; 500 is primary; 900/950 are dark fills/shadows.
        brand: {
          50:  '#fff4ed',
          100: '#ffe6d5',
          200: '#ffc8a8',
          300: '#ffa472',
          400: '#ff8a4c',
          500: '#ff5a1f',
          600: '#f54c12',
          700: '#c63a0c',
          800: '#9c2f0e',
          900: '#5a1d0a',
          950: '#2e1206',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020414',
        },
        // ── Slate ramp, repointed to the paper theme ──
        // The pre-paper app used Tailwind's slate ramp for all its on-dark text
        // (slate-300 body, slate-400 secondary, slate-500/600 faint). On the
        // manila ground those render as washed-out grey-blue, so the ramp is
        // remapped onto the pv ink/support tokens instead of being rewritten at
        // ~180 call sites. Light shades stay text-ish; 700+ were dark-theme
        // FILLS, so they map to paper tints and remain usable as backgrounds.
        slate: {
          50:  withOpacity('--pv-paper'),
          100: withOpacity('--pv-paper-deep'),
          200: withOpacity('--pv-ink'),
          300: withOpacity('--pv-ink'),
          400: withOpacity('--pv-support'),
          500: withOpacity('--pv-support'),
          600: withOpacity('--pv-support'),
          700: withOpacity('--pv-hairline'),
          800: withOpacity('--pv-paper-deep'),
          900: withOpacity('--pv-paper'),
          950: withOpacity('--pv-paper'),
        },
        // Translucent white surface fills (alpha baked in — no opacity modifier).
        tint: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
        // Hairline border tints (alpha baked in).
        line: {
          1: 'var(--line-1)',
          2: 'var(--line-2)',
          3: 'var(--line-3)',
        },
        // ── "The Official Document" landing palette (pv tokens) ──
        // Values live as --pv-* CSS variables in globals.css; components never
        // hardcode hex. stamp = dominant green accent; seal = budgeted orange.
        paper: {
          DEFAULT: withOpacity('--pv-paper'),
          deep: withOpacity('--pv-paper-deep'),
        },
        ink: withOpacity('--pv-ink'),
        stamp: {
          DEFAULT: withOpacity('--pv-stamp'),
          deep: withOpacity('--pv-stamp-deep'),
        },
        seal: {
          DEFAULT: withOpacity('--pv-seal'),
          // AA-safe small-text variants — see pv-tokens.css.
          text: withOpacity('--pv-seal-text'),
          bright: withOpacity('--pv-seal-bright'),
        },
        support: withOpacity('--pv-support'),
        hairline: withOpacity('--pv-hairline'),
        fail: {
          DEFAULT: withOpacity('--pv-fail'),
          text: withOpacity('--pv-fail-text'),
        },
        warn: {
          DEFAULT: withOpacity('--pv-warn'),
          text: withOpacity('--pv-warn-text'),
        },
        // Single readiness/quality language — shared by score bands and pills.
        readiness: {
          high: withOpacity('--readiness-high'),
          mid:  withOpacity('--readiness-mid'),
          low:  withOpacity('--readiness-low'),
        },
      },
      // ── Landing ("Official Document") semantic type scale ──
      // Sizes are --type-* vars from pv-tokens.css; the bundled .type-*
      // classes there also set family/weight — these Tailwind entries exist
      // for cases where size/leading alone is wanted.
      fontSize: {
        display:      ['var(--type-display)', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        title:        ['var(--type-title)', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        lead:         ['var(--type-lead)', { lineHeight: '1.45' }],
        'body-lg':    ['var(--type-body-lg)', { lineHeight: '1.65' }],
        body:         ['var(--type-body)', { lineHeight: '1.6' }],
        small:        ['var(--type-small)', { lineHeight: '1.5' }],
        'mono-micro': ['var(--type-mono-micro)', { lineHeight: '1.4', letterSpacing: '0.09em' }],
      },
      maxWidth: {
        content: 'var(--container-content)',   // 1440px page container
        wide:    'var(--container-wide)',      // 1560px breakout container
        measure: 'var(--measure)',             // 62ch prose cap (same as .measure)
      },
      spacing: {
        gutter: 'var(--gutter)',   // px-gutter — horizontal page padding
        rail:   'var(--rail)',     // w-rail / pl-rail — outer margin furniture column
        band:   'var(--band-y)',   // py-band — full-bleed section vertical padding
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Anton', 'sans-serif'],
        // Landing ("Official Document") stack — variables set by next/font in
        // app/pv-fonts.ts, scoped to the landing wrapper.
        // 'PV Serif Fallback' carries size-adjust metrics (pv-tokens.css) so
        // the headline keeps its line count while Newsreader loads.
        serif: ['var(--font-pv-serif)', 'PV Serif Fallback', 'Georgia', 'serif'],
        body:  ['var(--font-pv-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-pv-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-hero': 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
