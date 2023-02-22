/// <reference types="vitest" />
import packageJson from './package.json';
import { loadEnv, defineConfig, BuildOptions } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import pluginRewriteAll from 'vite-plugin-rewrite-all';
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
    base: '/apps/webterm',
    build:
      mode !== 'profile'
        ? {
            sourcemap: false,
          }
        : ({
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
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  });
};
