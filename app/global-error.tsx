'use client';

import { useEffect } from 'react';

const CHUNK_RECOVERY_KEY = 'tradeitm:chunk-recovery-attempted';

function isChunkLoadError(error: Error): boolean {
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    name.includes('chunkloaderror')
    || message.includes('loading chunk')
    || message.includes('chunkloaderror')
    || message.includes('failed to fetch dynamically imported module')
    || message.includes('css chunk load failed')
  );
}

async function recoverFromChunkError(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') return;
  sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.allSettled(
        keys
          .filter((key) => key.startsWith('tradeitm-'))
          .map((key) => caches.delete(key)),
      );
    }
  } catch (recoveryError) {
    console.error('Chunk recovery cleanup failed', recoveryError);
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('__chunk_recover', Date.now().toString());
  window.location.replace(nextUrl.toString());
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    console.error('Global error boundary caught an error', error);
    if (chunkError) {
      void recoverFromChunkError();
    }
  }, [chunkError, error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-white min-h-screen flex items-center justify-center font-sans">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="text-2xl text-red-400">!</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-white/60 text-sm mb-6">
            {chunkError
              ? 'A new version is available. Reload to sync the latest homepage assets.'
              : 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => {
              if (chunkError) {
                void recoverFromChunkError();
                return;
              }
              reset();
            }}
            className="px-6 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
          >
            {chunkError ? 'Reload latest version' : 'Try again'}
          </button>
        </div>
      </body>
    </html>
  );
}
