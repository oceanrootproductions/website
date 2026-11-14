import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'

/**
 * Applies the 301/302 rules from public/_redirects in `vite dev` too (Netlify applies them in production), for paths with
 * no file behind them — so a demo whose pack lives in Cloudflare R2 loads locally the same way it does on the live site.
 */
function netlifyRedirects(): Plugin {
  return {
    name: 'netlify-redirects',
    configureServer(server) {
      const publicDir = server.config.publicDir
      const rules = fs
        .readFileSync(path.join(publicDir, '_redirects'), 'utf8')
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter(([from, , status]) => from && !from.startsWith('#') && (status === '301' || status === '302'))
        .map(([from, to, status]) => {
          const names: string[] = []
          const escaped = from.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          const pattern = new RegExp('^' + escaped.replace(/:(\w+)/g, (_, name) => (names.push(name), '([^/]+)')) + '$')
          return { pattern, names, to, status: Number(status) }
        })

      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (fs.existsSync(path.join(publicDir, url))) return next()
        for (const rule of rules) {
          const match = url.match(rule.pattern)
          if (!match) continue
          const target = rule.names.reduce((t, name, i) => t.split(':' + name).join(match[i + 1]), rule.to)
          res.statusCode = rule.status
          res.setHeader('Location', target)
          res.end()
          return
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const ensureSlashes = (p: string) => {
    if (!p.startsWith('/')) p = '/' + p
    if (!p.endsWith('/')) p = p + '/'
    return p
  }
  // Default to GitHub Pages repo name (/website/) unless overridden
  let base = process.env.BASE_PATH
  if (!base && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repo) base = `/${repo}/`
  }
  base = ensureSlashes(base || '/')
  return {
    base,
    plugins: [react(), netlifyRedirects()],
    assetsInclude: ['**/*.fbx'],
    build: {
      target: 'es2018',
      sourcemap: false,
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    server: {
      port: 5173,
    },
  }
})
