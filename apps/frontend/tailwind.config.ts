import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        'bg-dark': '#0B0B0B',
        'panel-green': 'var(--panel-green)',
        'panel-navy': 'var(--panel-navy)',
        'panel-purple': 'var(--panel-purple)',
        'sidebar-bg': 'var(--sidebar-bg)',
        'header-bg': 'var(--header-bg)',
        'card-bg': 'var(--card-bg)',
        'card-bg-alt': 'var(--card-bg-alt)',
        'card-border': 'var(--card-border)',
        'input-bg': 'var(--input-bg)',
        'sidebar-border': 'var(--sidebar-border)',
        divider: 'var(--divider)',
        t1: 'var(--t1)',
        t2: 'var(--t2)',
        t3: 'var(--t3)',
        t4: 'var(--t4)',
        'brand-cyan': '#22d3ee',
        'brand-blue': '#0284c7',
        'brand-navy': '#0e7490',
        'status-online': '#22d3ee',
        'status-offline': '#ef4444',
        'status-warning': '#f59e0b',
        'tt-primary': '#00D48A',
        'tt-danger': '#FF4D4D',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
        outfit: ["'Outfit'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
