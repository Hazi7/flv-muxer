import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig({
  plugins: [checker({ typescript: true })],
  build: {
    rollupOptions: {
      input: './src/index.ts', // 入口文件路径
    },
    outDir: 'dist', // 输出目录
  },
});
