// @ts-check
import { defineConfig } from 'astro/config';

// Static output: `npm run build` writes plain HTML/CSS/JS to `dist/`,
// which can be served by any static host (Netlify, GitHub Pages, Cloudflare Pages, a classic webspace …).
// Deploy target. Defaults to the final domain; the GitHub Pages workflow
// overrides both while the site is served from esreverse.github.io/esreverse/.
const site = process.env.SITE_URL ?? 'https://www.esreverse.com';
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // /quitehandy → dist/quitehandy/index.html (works on every static host)
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
