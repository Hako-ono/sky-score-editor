import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base を './' にしておくと、GitHub Pages などのサブパス配信でも
// public/fonts/ 配下のPDF埋め込み用フォントを相対解決できる。
export default defineConfig({
  base: './',
  plugins: [react()],
});
