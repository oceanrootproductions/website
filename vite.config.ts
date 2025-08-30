import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const ensureSlashes = (p: string) => {
    if (!p.startsWith('/')) p = '/' + p
    if (!p.endsWith('/')) p = p + '/'
    return p
  }
  // Derive base for GitHub Pages automatically when running in CI
  let base = process.env.BASE_PATH
  if (!base && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repo) base = `/${repo}/`
  }
  base = ensureSlashes(base || '/')
  return {
    base,
    plugins: [react()],
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
