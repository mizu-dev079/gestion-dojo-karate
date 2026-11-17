import { defineConfig } from 'astro/config';
import base from './astro.config.mjs';
import { crearApiSimulada } from './simulacion/api.mjs';

// Se utiliza únicamente mediante dev:simulado. El build normal no importa este archivo.
export default defineConfig({
  ...base,
  server: { port: 4322, host: true },
  vite: {
    ...base.vite,
    envDir: false,
    define: { 'import.meta.env.PUBLIC_API_URL': JSON.stringify('/api-simulada') },
    server: { strictPort: true },
    plugins: [
      ...base.vite.plugins,
      {
        name: 'dojo-api-simulada',
        apply: 'serve',
        configureServer(server) {
          const api = crearApiSimulada();
          server.middlewares.use(api.middleware);
        },
      },
    ],
  },
});
