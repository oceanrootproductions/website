# OceanRoot Productions — Website

Minimalist, responsive website for a VR studio using React 18 + TypeScript + Vite, TailwindCSS, React Router, and a lightweight React Three Fiber hero scene.

## Tech

- React 18 + TypeScript + Vite
- TailwindCSS for styling
- React Router for SPA routing (with 404 fallback)
- React Three Fiber + @react-three/drei for 3D hero
- Optional Leva panel (hidden on mobile)

## Local Development

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open http://localhost:5173

## Build

- `npm run build` (outputs to `dist/`)
- Preview locally: `npm run preview`

## GitHub Pages Deployment

This project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:

- Builds with Vite using `BASE_PATH=/<repo-name>/` automatically.
- Copies `dist/index.html` to `dist/404.html` for SPA fallback.
- Uploads `dist/` to GitHub Pages.

Steps:

1. Push the repo to GitHub.
2. Set the default branch to `main` (or update the workflow trigger branch).
3. Enable GitHub Pages: Settings → Pages → Source: GitHub Actions.
4. Push to `main`. The site will deploy automatically to `https://<user>.github.io/<repo>/`.

## Notes on Performance

- The 3D hero is code-split and lazy-loaded with Suspense.
- WebGL fallback: if unavailable, a static SVG is shown.
- Mobile reduces particle count; `prefers-reduced-motion` disables auto-rotate.
- Uses ContactShadows, Environment preset "sunset", and Float for subtle motion. No heavy post.

## Branding

- Colors: deep-ocean `#0B3B5A`, seafoam `#EAF7FB`, coral-accent `#FF6B6B`, ink `#0B0F12`.
- Fonts: headings use Sora (fallback Inter); body uses Inter.
