import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { BRANDING_PRESETS, normalizeBrandMode } from './src/config/branding.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const brand = BRANDING_PRESETS[normalizeBrandMode(env.VITE_BRAND_MODE)];

  return {
    plugins: [
      {
        name: 'brand-html',
        transformIndexHtml(html) {
          return html
            .replace(/<title>.*<\/title>/, `<title>${brand.name} — ${brand.subtitle}</title>`)
            .replace(
              /<meta name="description" content="[^"]*" \/>/,
              `<meta name="description" content="${brand.description}" />`,
            )
            .replace(
              /<meta name="theme-color" content="[^"]*" \/>/,
              `<meta name="theme-color" content="${brand.colors.accent}" />`,
            );
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: brand.name,
          short_name: brand.shortName,
          description: brand.description,
          theme_color: brand.colors.accent,
          background_color: '#05080c',
          display: 'fullscreen',
          orientation: 'landscape',
          start_url: '.',
          icons: [
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,webp,avif,png,woff2}'],
        },
      }),
    ],
  };
});
