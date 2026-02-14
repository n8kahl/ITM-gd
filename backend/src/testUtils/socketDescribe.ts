export const describeWithSockets: typeof describe =
  process.env.JEST_SOCKET_BIND_ALLOWED === '1' || process.env.JEST_FORCE_SOCKET_TESTS === '1'
    ? describe
    : describe.skip;
