import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

// Use package files, rather than minifier comments, so attribution survives builds.
export function thirdPartyLicenses(): Plugin {
  const packages = new Map<string, { root: string; files: Set<string> }>();
  let projectRoot = process.cwd();
  let combinedNotices = '';
  return {
    name: 'third-party-licenses',
    configResolved(config) {
      projectRoot = config.root;
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const [id, module] of Object.entries(chunk.modules)) {
          if (module.renderedLength === 0) continue;
          const filename = id.replace(/^\0/, '').split('?')[0];
          if (!filename.includes('/node_modules/') || !existsSync(filename))
            continue;
          let directory = path.dirname(realpathSync(filename));
          const notices = new Set<string>();
          while (directory !== path.dirname(directory)) {
            for (const file of readdirSync(directory, {
              withFileTypes: true,
            })) {
              if (
                file.isFile() &&
                /^(licen[cs]e|notice|copying)([.-]|$)/i.test(file.name)
              ) {
                notices.add(path.join(directory, file.name));
              }
            }
            const manifest = path.join(directory, 'package.json');
            if (existsSync(manifest)) {
              const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
              if (metadata.name && metadata.version) {
                const key = `${metadata.name}@${metadata.version}`;
                const entry = packages.get(key) ?? {
                  root: directory,
                  files: new Set<string>(),
                };
                for (const file of notices) entry.files.add(file);
                packages.set(key, entry);
                break;
              }
            }
            directory = path.dirname(directory);
          }
        }
      }
      const sections = [
        'Third-party software notices\n\nEach component retains its original license.\nSource packages: https://www.npmjs.com/ (use the exact versions below).',
      ];
      for (const [name, entry] of [...packages].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const metadata = JSON.parse(
          readFileSync(path.join(entry.root, 'package.json'), 'utf8'),
        );
        const repository =
          typeof metadata.repository === 'string'
            ? metadata.repository
            : metadata.repository?.url;
        const header = `${name}\nLicense: ${metadata.license ?? 'See license text'}\nSource: https://www.npmjs.com/package/${metadata.name}/v/${metadata.version}\n${repository ?? ''}`;
        let texts = [...entry.files]
          .sort()
          .map(
            (file) =>
              `${path.relative(entry.root, file)}\n\n${readFileSync(file, 'utf8')}`,
          );
        const supplements: Record<string, string> = {
          '@vitejs/plugin-rsc@0.5.26': 'vite-plugin-rsc.LICENSE',
          '@vitejs/plugin-rsc@0.5.38': 'vite-plugin-rsc.LICENSE',
          'drizzle-orm@0.45.2': 'drizzle-orm.LICENSE',
          'react-remove-scroll-bar@2.3.8': 'react-remove-scroll-bar.LICENSE',
        };
        if (texts.length === 0 && supplements[name]) {
          texts = [
            readFileSync(
              new URL(`../vendor/${supplements[name]}`, import.meta.url),
              'utf8',
            ),
          ];
        }
        if (texts.length === 0)
          this.error(
            `${name}: no license text found; review before distributing.`,
          );
        sections.push(`${header}\n\n${texts.join('\n\n')}`);
      }
      for (const file of [
        'vendor/shadcn-tailwind-4.13.0.LICENSE.md',
        'build/sites-vite-plugin.LICENSE',
      ]) {
        sections.push(
          `${file}\n\n${readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')}`,
        );
      }
      combinedNotices =
        sections.join('\n\n========================================\n\n') +
        '\n';
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source: combinedNotices,
      });
    },
    writeBundle() {
      // Vinext builds rsc, client, then ssr. Keep the public copy inclusive of all three.
      const directory = path.join(projectRoot, 'dist/client');
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        path.join(directory, 'third-party-licenses.txt'),
        combinedNotices,
      );
    },
  };
}
