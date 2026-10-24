'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Bootstrap } from './bootstrap';
import FishingApp from './fishing-app';
import LoginScreen from './login-screen';
import Brand from './brand';

const subscribe = () => () => {};
const loginFailed = () =>
  new URLSearchParams(window.location.search).has('login_error');
const serverLoginFailed = () => false;

export default function FishingRoot() {
  const [state, setState] = useState<
    Bootstrap | 'checking' | 'login' | 'error'
  >('checking');
  const failed = useSyncExternalStore(
    subscribe,
    loginFailed,
    serverLoginFailed,
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/bootstrap', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setState('login');
          return;
        }
        if (!response.ok) throw Error('Unable to load app configuration.');
        const value: Bootstrap = await response.json();
        if (!controller.signal.aborted) setState(value);
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  if (typeof state === 'object') {
    return (
      <FishingApp
        {...state}
        signInPath="/api/auth/google"
        signOutPath="/api/auth/logout"
      />
    );
  }
  if (state === 'error') {
    return (
      <main className="app-startup" data-cy="app-loading">
        <Brand />
        <p role="alert">読み込みに失敗しました。もう一度お試しください。</p>
        <button type="button" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </main>
    );
  }
  return <LoginScreen loginFailed={failed} checking={state === 'checking'} />;
}
