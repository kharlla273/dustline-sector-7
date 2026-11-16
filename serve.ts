// A tiny static server for local play-testing (Node 22, standard library
// only): serves game/ at http://localhost:8080. No build step, no network
// beyond the loopback: the game loads its own files and nothing else.
//
//   node serve.ts
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => {
  console.log(`DUSTLINE at http://localhost:${port}`);
});
