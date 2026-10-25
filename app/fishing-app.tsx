'use client';

import dynamic, { type DynamicOptionsLoadingProps } from 'next/dynamic';
import type { ComponentProps } from 'react';
import Brand from './brand';
import type FishingLog from './fishing-log';

function Loading({ error }: DynamicOptionsLoadingProps) {
  return (
    <main className="app-startup" data-cy="app-loading">
      <Brand />
      {error ? (
        <>
          <p role="alert">画面を読み込めませんでした。再度お試しください。</p>
          <button type="button" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </>
      ) : (
        <p role="status">画面を読み込んでいます…</p>
      )}
    </main>
  );
}

// Authentication stays in the bootstrap API. Render the dashboard in the browser
// so Workers need not load and render its component tree on every page request.
const FishingApp = dynamic<ComponentProps<typeof FishingLog>>(
  () => import('./fishing-log'),
  { ssr: false, loading: Loading },
);

export default FishingApp;
