import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'https://rikisample.test';
  const configuredPrefix = env.VITE_API_PROXY_PATH_PREFIX;
  const proxyPrefix = (configuredPrefix === undefined ? '/learnenglish' : configuredPrefix).replace(/\/$/, '');
  return {
    base: '/learnenglish/',
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/learnenglish/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: path => path.replace(/^\/learnenglish\/api/, `${proxyPrefix}/api`),
        },
      },
    },
    preview: { host: '0.0.0.0', allowedHosts: true },
  };
});
