import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import babel from 'vite-plugin-babel'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // @vitejs/plugin-react v6 transforms JSX/TSX via oxc, which can't run Babel plugins —
    // so the Lingui macro transform (t / <Trans>) runs as a separate Babel pass first,
    // stripping TS types and expanding macros, then handing plain JSX off to oxc.
    babel({
      include: /\.tsx?$/,
      babelConfig: {
        presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@specs': path.resolve(rootDir, '../../specs'),
    },
  },
})
