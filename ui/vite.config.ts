/// <reference types="vitest" />
import packageJson from './package.json';
import { loadEnv, defineConfig, BuildOptions } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import { fileURLToPath } from 'url';

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  process.env.VITE_STORAGE_VERSION =
    mode === 'dev' ? Date.now().toString() : packageJson.version;

  Object.assign(process.env, loadEnv(mode, process.cwd()));
  const SHIP_URL =
    process.env.SHIP_URL ||
    process.env.VITE_SHIP_URL ||
    'http://localhost:8080';
  console.log(SHIP_URL);

  const plugins = [
    urbitPlugin({
      base: 'webterm',
      target: SHIP_URL,
      changeOrigin: true,
      secure: false,
    }),
    reactRefresh(),
  ];

  return defineConfig({
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['../../'],
      },
    },
    base: '/apps/webterm',
    build:
      mode !== 'profile'
        ? {
            target: "es2020",
            sourcemap: false,
          }
        : ({
            target: "es2020",
            rollupOptions: {
              plugins: [
                analyze({
                  limit: 20,
                }),
                visualizer(),
              ],
            },
          } as BuildOptions),
    plugins: plugins,
    optimizeDeps: {
      esbuildOptions: { target: "es2020", supported: { bigint: true } },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  });
};
