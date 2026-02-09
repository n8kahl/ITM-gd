export async function register() {
  // Sentry is intentionally disabled in this environment.
}

export const onRequestError = (...args: unknown[]) => {
  const [error] = args;
  if (error instanceof Error) {
    console.error('Request error captured by instrumentation', error.message);
  }
};
