import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeGlossary from './plugins/rehype-glossary.mjs';

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeSlug, rehypeGlossary, [rehypeKatex, { strict: false, output: 'html' }]],
      }),
    },
    react({ include: /\.(mdx|tsx|ts)$/ }),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
