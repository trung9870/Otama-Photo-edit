import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // SECURITY: KHÔNG inject API key vào client bundle.
      // Mọi tham chiếu process.env.X trong client code sẽ thành "" tại build.
      // Server (Vercel functions / Express) đọc env qua process.env thật ở Node runtime.
      'process.env.GEMINI_API_KEY': '""',
      'process.env.API_KEY': '""',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
