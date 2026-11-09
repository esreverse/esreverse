# esreverse.com

Website of Eric Singhartinger – Experience Designer. A hand-coded rebuild of the former Framer site,
plus the product page for the Mac app [TinyPointer](https://github.com/esreverse/tinypointer) at
`/tinypointer`.

- **Static output:** plain HTML, CSS and a few small scripts. No framework runtime, no tracking.
- **Light and dark mode** follow the system setting (`prefers-color-scheme`).
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



## Structure

```text
public/                     served as-is
  icons/                    favicons (light/dark) and apple-touch-icon
  og-image.png              social sharing image
  unicorn/                  self-hosted Unicorn Studio runtime and exported scene
src/
  assets/                   images and SVGs processed at build time
  components/               one component per section (Hero, About, KeySkills, …)
  components/tinypointer/   parts of the TinyPointer page
  data/site.ts              links and lists (nav, social links, tools, patterns)
  layouts/Base.astro        <head>, meta tags, global styles
  pages/index.astro         home page
  pages/tinypointer/        TinyPointer product page
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

- **Scroll reveals** and the **TinyPointer story** use CSS scroll-driven animations. Browsers without
  support, and visitors with reduced motion, get the content without motion.
- **Logo ticker** and **rotating footer words** are CSS animations.
- **Small scripts:** nav scroll-spy, carousel buttons, the cursor dot, and lazy start of the Unicorn
  Studio background. Everything works without them.


### Unicorn Studio

The animated gradient in the hero and footer is a Unicorn Studio scene. Runtime and scene JSON are
self-hosted in `public/unicorn/`, so no third-party requests are made. Only `UnicornScene.astro` knows
about it; replace that component to swap the effect. After changing the scene in Unicorn Studio,
export it again to `public/unicorn/flow-gradient.json`.


### TinyPointer Page

`/tinypointer` is a vertical scroll story: a sticky "desktop", the TinyPointer hand rising in, and
one sheet of paper per feature. The interactive parts (drawing, rainbow ink, stamps, arrows on the
sheets) are not built yet; `Sheet.astro` marks where they go.



## Third-Party Assets and Licences

- **Inter** and **Playpen Sans:** SIL Open Font License, via Fontsource.
- **TinyPointer hand and menu bar icon:** from the TinyPointer repository, MIT License.
- **Unicorn Studio runtime:** © Unicorn Studio, self-hosted as their embed docs describe.
- **Client logos:** trademarks of their owners, shown as client references.
