// Jest setup file - runs before all tests
// Set mock environment variables
process.env.MASSIVE_API_KEY = 'test-api-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OPENAI_API_KEY = 'sk-test-openai-key';

// Probe once for socket-bind capability so integration suites can auto-skip
// in restricted sandboxes while still running in normal dev/CI environments.
if (!process.env.JEST_SOCKET_BIND_ALLOWED) {
  const { spawnSync } = require('child_process');
  const probe = spawnSync(
    process.execPath,
    [
      '-e',
      [
        "const net=require('net');",
        'const server=net.createServer();',
        "server.once('error',()=>process.exit(1));",
        "server.listen(0,'127.0.0.1',()=>server.close(()=>process.exit(0)));",
        'setTimeout(()=>process.exit(2), 1000);',
      ].join(''),
    ],
    { stdio: 'ignore' },
  );
  process.env.JEST_SOCKET_BIND_ALLOWED = probe.status === 0 ? '1' : '0';
}
