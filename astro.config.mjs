// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages org site: https://ionlab-dgu.github.io (no base path)
  site: 'https://ionlab-dgu.github.io',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
