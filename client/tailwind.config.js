module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        primary: 'rgb(var(--sf-primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--sf-primary-hover) / <alpha-value>)',
        'primary-soft': 'rgb(var(--sf-primary-soft) / <alpha-value>)',
        canvas: 'rgb(var(--sf-canvas) / <alpha-value>)',
        surface: 'rgb(var(--sf-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--sf-surface-muted) / <alpha-value>)',
        ink: 'rgb(var(--sf-ink) / <alpha-value>)',
        muted: 'rgb(var(--sf-muted) / <alpha-value>)',
        line: 'rgb(var(--sf-border) / <alpha-value>)',
        dark: "#000000",
        light: "#FFFFFF",
      },
      fontFamily: { sans: ['var(--sf-font-sans)'] },
      fontSize: {
        display: ['clamp(2.25rem, 5vw, 3.5rem)', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        title: ['clamp(1.75rem, 3vw, 2.25rem)', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '700' }],
        heading: ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.02em', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
      },
      maxWidth: { content: 'var(--sf-content-width)', reading: 'var(--sf-reading-width)' },
      borderRadius: { control: 'var(--sf-radius-control)', card: 'var(--sf-radius-card)', panel: 'var(--sf-radius-panel)' },
      boxShadow: { soft: 'var(--sf-shadow-soft)', card: 'var(--sf-shadow-card)', floating: 'var(--sf-shadow-floating)' },
      spacing: { gutter: 'var(--sf-gutter)', section: 'var(--sf-section-space)' },
    },
  },
  plugins: [],
};
