import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const baseRequire = createRequire(require.resolve('@base-ui/react'));
const floatingRequire = createRequire(
  baseRequire.resolve('@floating-ui/react-dom'),
);
const domPath = floatingRequire.resolve('@floating-ui/dom');

for (const mode of ['require', 'import']) {
  test(`floating resize updates run outside observer delivery and stop after cleanup (${mode})`, async () => {
    const { autoUpdate } =
      mode === 'require'
        ? require(domPath)
        : await import(pathToFileURL(domPath.replace('.umd.js', '.mjs')));
    const names = [
      'window',
      'Element',
      'ResizeObserver',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ];
    const original = new Map(
      names.map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
    class Element {}
    const frames = new Map();
    let frameId = 0;
    let observer;
    let delivering = false;
    let updates = 0;
    const anchor = new Element();
    const popup = new Element();
    const flush = () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback());
    };
    Object.assign(globalThis, {
      window: { Element },
      Element,
      requestAnimationFrame(callback) {
        frames.set(++frameId, callback);
        return frameId;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      },
      ResizeObserver: class {
        targets = new Set();
        constructor(callback) {
          this.callback = callback;
          observer = this;
        }
        observe(target) {
          this.targets.add(target);
        }
        unobserve(target) {
          this.targets.delete(target);
        }
        disconnect() {
          this.targets.clear();
        }
      },
    });
    let cleanup;
    try {
      cleanup = autoUpdate(
        anchor,
        popup,
        () => {
          assert.equal(
            delivering,
            false,
            'layout writes must not run in ResizeObserver delivery',
          );
          updates++;
        },
        { ancestorScroll: false, ancestorResize: false, layoutShift: false },
      );
      assert.equal(updates, 1, 'initial positioning stays immediate');
      const deliver = (target) => {
        delivering = true;
        try {
          observer.callback([{ target }]);
        } finally {
          delivering = false;
        }
      };
      deliver(anchor);
      assert.equal(updates, 1);
      flush();
      assert.equal(updates, 2, 'anchor resizing still updates positioning');
      assert.ok(observer.targets.has(popup), 'popup observation resumes');
      deliver(popup);
      deliver(popup);
      flush();
      assert.equal(
        updates,
        3,
        'popup resizing is coalesced into one layout update',
      );
      deliver(anchor);
      cleanup();
      flush();
      assert.equal(updates, 3, 'unmount cancels queued positioning');
      assert.equal(observer.targets.size, 0);
    } finally {
      cleanup?.();
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
}
