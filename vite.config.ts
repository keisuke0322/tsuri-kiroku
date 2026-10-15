import vinext from 'vinext';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { thirdPartyLicenses } from './build/third-party-licenses';

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      inspectorPort: false,
      configPath: process.env.CF_CONFIG || 'wrangler.jsonc',
    }),
    thirdPartyLicenses(),
  ],
});
