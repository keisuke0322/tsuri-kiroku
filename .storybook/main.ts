import type { StorybookConfig } from '@storybook/react-vite';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { thirdPartyLicenses } from '../build/third-party-licenses';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx', '../stories/**/*.mdx'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: fileURLToPath(
          new URL('./vite.config.ts', import.meta.url),
        ),
      },
    },
  },
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    return mergeConfig(config, {
      base: './',
      resolve: {
        alias: { '@': fileURLToPath(new URL('../', import.meta.url)) },
      },
      plugins: [thirdPartyLicenses('storybook-static')],
    });
  },
};

export default config;
