// @ts-check
import { defineConfig } from 'astro/config';

// Static output: `npm run build` writes plain HTML/CSS/JS to `dist/`,
// which can be served by any static host (Netlify, GitHub Pages, Cloudflare Pages, a classic webspace …).
export default defineConfig({
  site: 'https://www.esreverse.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // /tinypointer → dist/tinypointer/index.html (works on every static host)
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
