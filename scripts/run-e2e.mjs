import { spawn } from 'node:child_process';
import process from 'node:process';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 4173;
const server = await createServer({
  logLevel: 'error',
  server: { host, port, strictPort: true },
});

let playwright;

try {
  await server.listen();
  playwright = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
    {
      env: { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: '1' },
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  process.exitCode = await new Promise((resolve, reject) => {
    playwright.once('error', reject);
    playwright.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Playwright was interrupted by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
} finally {
  if (playwright && playwright.exitCode === null) playwright.kill();
  await server.close();
}
