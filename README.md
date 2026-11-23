# esreverse.com

Website of Eric Singhartinger – Experience Designer. A hand-coded rebuild of the former Framer site,
The Mac app [Quite Handy](https://quitehandy.app) has its own site now (the esreverse/quitehandy-website repo).
`/quitehandy` and `/quitehandy/download` only forward there, for a few weeks. The update feed
`public/quitehandy/appcast.xml` stays for installs of 1.7.0 to 2.3, and so do the releases
`quitehandy-v…` with their DMGs.

- **Static output:** plain HTML, CSS and a few small scripts. No framework runtime, no tracking.
- **Light mode** for now. A dark mode exists in the code but is commented out (search for `DARK MODE`)
  while the light mode is being refined.
- **Responsive** with the original breakpoints: phone (< 768 px), tablet (768–1279 px), desktop (≥ 1280 px).
- **Hostable anywhere** that serves static files.



## Requirements

- Node.js 22.23.4 or later (see `.nvmrc`; with nvm: `nvm use`)
- npm



## Develop, Build and Preview

```bash
npm install        # once
npm run dev        # dev server at http://localhost:4321
npm run build      # static site into dist/
npm run preview    # serve dist/ locally to check the build
```

Deploy by uploading the contents of `dist/` or by letting a static host build the repository
(build command `npm run build`, output directory `dist`).



## Deployment

Every push to `main` builds the site and publishes it to **GitHub Pages**
(`.github/workflows/deploy.yml`). Progress: the repository's **Actions** tab.

The site is served at <https://www.esreverse.com> (custom domain in Settings → Pages).
DNS at Host Europe: `esreverse.com` has four A records `185.199.108.153` – `185.199.111.153`,
`www` is a CNAME to `esreverse.github.io`. Mail (iCloud MX, SPF, DKIM) is untouched.

Internal links go through `url()` in `src/lib/url.ts`. For a preview under a sub-path (e.g.
`esreverse.github.io/esreverse/`), build with `SITE_URL` and `SITE_BASE`; such builds are marked
`noindex`.



## Structure

```text
public/                     served as-is
  icons/                    favicons (light/dark) and apple-touch-icon
  og-image.png              social sharing image
  unicorn/                  self-hosted Unicorn Studio runtime and exported scene
src/
  assets/                   images and SVGs processed at build time
  components/               one component per section (Hero, About, KeySkills, …)
  data/site.ts              links and lists (nav, social links, tools, patterns)
  layouts/Base.astro        <head>, meta tags, global styles
  pages/index.astro         home page
  pages/quitehandy/         forwards to quitehandy.app (for a few weeks); appcast.xml stays
  styles/tokens.css         design tokens (colours, type, spacing, light/dark)
  styles/global.css         reset, typography, shared building blocks
```



## How Things Work


### Styling

All colours, sizes and spacings are CSS custom properties in `src/styles/tokens.css`. Primitive colours
are taken from the original site; semantic tokens (`--surface-*`, `--text-*`) map them to roles and are
redefined for dark mode. Components keep their own styles in scoped `<style>` blocks.

Typography uses Inter (self-hosted via Fontsource) at optical size 32, which equals the "Inter Display"
cut of the original.


### Motion and JavaScript

- **Smooth scrolling** uses [Lenis](https://github.com/darkroomengineering/lenis) with the same setting
  as the original site (duration 1 s). Off for reduced motion.
- **Scroll reveals** use CSS scroll-driven animations. Browsers without
  support, and visitors with reduced motion, get the content without motion.
- **Logo ticker** and **rotating footer words** are CSS animations.
- **Small scripts:** nav scroll-spy, carousel buttons, the cursor dot (replaces the system cursor and
  grows over links and buttons), and lazy start of the Unicorn Studio background. The home page works
  without them.


### Unicorn Studio

The animated gradient in the hero and footer is a Unicorn Studio scene. Runtime and scene JSON are
self-hosted in `public/unicorn/`, so no third-party requests are made. Only `UnicornScene.astro` knows
about it; replace that component to swap the effect. After changing the scene in Unicorn Studio,
export it again to `public/unicorn/flow-gradient.json`.



## Third-Party Assets and Licences

- **Inter**, **Playpen Sans** and **DM Mono:** SIL Open Font License, via Fontsource.
- **Lenis:** MIT License.
- **Unicorn Studio runtime:** © Unicorn Studio, self-hosted as their embed docs describe.
- **Client logos:** trademarks of their owners, shown as client references.
