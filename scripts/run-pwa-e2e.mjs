import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import process from 'node:process';

const host = '127.0.0.1';
const port = 4173;
const publicBase = '/enduro/';
const distRoot = join(process.cwd(), 'dist');

const mimeTypes = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

async function run(command, args, env = process.env) {
  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });

  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (exitCode, signal) => {
      if (signal) {
        reject(new Error(`${command} was interrupted by ${signal}.`));
        return;
      }
      resolve(exitCode ?? 1);
    });
  });

  if (code !== 0) throw new Error(`${command} exited with code ${code}.`);
}

const buildEnvironment = {
  ...process.env,
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'marcosmallet/enduro',
  VITE_BRAND_MODE: 'ORIGINAL_PUBLIC_BUILD',
};

await run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], buildEnvironment);
await run(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--mode', 'public'],
  buildEnvironment,
);

let serviceWorkerRevision = 0;

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);

    if (requestUrl.pathname === '/__pwa_test__/next-sw') {
      serviceWorkerRevision += 1;
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (!requestUrl.pathname.startsWith(publicBase)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const relativeRequest = decodeURIComponent(requestUrl.pathname.slice(publicBase.length));
    const normalizedRequest = normalize(relativeRequest).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = join(distRoot, normalizedRequest || 'index.html');

    try {
      const fileStats = await stat(filePath);
      if (fileStats.isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      if (request.headers.accept?.includes('text/html')) filePath = join(distRoot, 'index.html');
    }

    let body = await readFile(filePath);
    const extension = extname(filePath);
    const headers = {
      'content-type': mimeTypes.get(extension) ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    };

    if (filePath.endsWith(`${join('', 'sw.js')}`)) {
      body = Buffer.concat([
        body,
        Buffer.from(`\n// PWA E2E revision ${serviceWorkerRevision}\n`, 'utf8'),
      ]);
      headers['cache-control'] = 'no-store';
      headers['service-worker-allowed'] = publicBase;
    }

    response.writeHead(200, headers);
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.stack ?? error.message : String(error));
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});

try {
  await run(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      'tests/e2e/pwa-offline.spec.ts',
      '--project=desktop-720p',
    ],
    {
      ...process.env,
      PLAYWRIGHT_EXTERNAL_SERVER: '1',
      PWA_PRODUCTION_E2E: '1',
    },
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
