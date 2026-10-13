import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { FileExplorer, ALLOWED_EXTENSIONS } from './src/explorer.ts';
import {
  renderHtmlDirectoryListing,
  renderAsciiDirectoryListing,
  renderNotFoundHtml,
  renderForbiddenHtml,
  renderLoginPage,
} from './src/templates.ts';
import {
  isAuthenticated,
  checkCredentials,
  createSessionToken,
  makeSetCookieHeader,
  makeClearCookieHeader,
} from './src/auth.ts';

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DISPLAY_HOST = process.env.DISPLAY_HOST || 'localhost';
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || './storage');
const TITLE = process.env.TITLE || 'Swirl-Mirror Repository';

// Ensure files and folders created by the server are accessible across both Docker and native host runs
process.umask(0);

// Initialize file explorer & ensure storage directory exists
const explorer = new FileExplorer(STORAGE_DIR);

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS & Server header
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.setHeader('Server', 'swirl-mirror/1.0');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Access log
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────

// GET /login — tampilkan halaman login
app.get('/login', (req: Request, res: Response) => {
  // Sudah login → redirect ke home
  if (isAuthenticated(req.headers.cookie)) {
    return res.redirect('/');
  }
  const opts = { serverHost: DISPLAY_HOST, serverPort: PORT };
  const redirect = (req.query.redirect as string) || '/';
  res.type('text/html; charset=utf-8').send(renderLoginPage({ ...opts, redirect }));
});

// POST /auth/login — proses login
app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password, redirect } = req.body as Record<string, string>;
  const opts = { serverHost: DISPLAY_HOST, serverPort: PORT };
  const redirectTo = redirect && redirect.startsWith('/') ? redirect : '/';

  if (!checkCredentials(username || '', password || '')) {
    res.type('text/html; charset=utf-8').send(
      renderLoginPage({ ...opts, error: 'Nama pengguna atau kata sandi salah.', redirect: redirectTo })
    );
    return;
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', makeSetCookieHeader(token));
  res.redirect(redirectTo);
});

// GET /auth/logout — hapus sesi
app.get('/auth/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', makeClearCookieHeader());
  res.redirect('/');
});

// ─── API Routes ──────────────────────────────────────────────────────────────

// Status & statistics
app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const stats = await explorer.getOverallStats();
    res.json({
      status: 'ok',
      title: TITLE,
      allowedExtensions: [...ALLOWED_EXTENSIONS],
      ...stats,
      system: {
        runtime: 'Bun ' + Bun.version,
        uptimeSeconds: Math.floor(process.uptime()),
        platform: process.platform,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recursive file tree
app.get('/api/tree', async (_req: Request, res: Response) => {
  try {
    const tree = await explorer.getRecursiveTree();
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create directory
app.post('/api/mkdir', async (req: Request, res: Response) => {
  if (!isAuthenticated(req.headers.cookie)) {
    return res.status(401).json({ error: 'Tidak terautentikasi. Silakan login terlebih dahulu.' });
  }

  const targetPath = req.body?.path;
  if (!targetPath || typeof targetPath !== 'string') {
    return res.status(400).json({ error: 'Parameter "path" wajib disertakan' });
  }

  const { fullPath, isSafe, relPath } = explorer.resolveSafePath(targetPath);
  if (!isSafe) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  try {
    await fs.promises.mkdir(fullPath, { recursive: true, mode: 0o777 });
    await fs.promises.chmod(fullPath, 0o777).catch(() => {});
    res.json({ success: true, path: relPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE: Remove file or directory ────────────────────────────────────────
app.delete('{*path}', async (req: Request, res: Response) => {
  if (!isAuthenticated(req.headers.cookie)) {
    return res.status(401).json({ error: 'Tidak terautentikasi. Silakan login terlebih dahulu.' });
  }

  const { fullPath, isSafe, relPath } = explorer.resolveSafePath(req.path);

  if (!isSafe || fullPath === explorer.getBaseDir()) {
    return res.status(403).json({ error: 'Tidak dapat menghapus path ini' });
  }

  try {
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(fullPath);
    }
    res.json({ success: true, deleted: relPath });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Tidak ditemukan' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT: Upload file (only allowed extensions) ─────────────────────────────
app.put('{*path}', (req: Request, res: Response) => {
  if (!isAuthenticated(req.headers.cookie)) {
    return res.status(401).json({ error: 'Tidak terautentikasi. Silakan login terlebih dahulu.' });
  }

  const { fullPath, isSafe, relPath } = explorer.resolveSafePath(req.path);

  if (!isSafe) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  // Validate file extension
  const filename = path.basename(fullPath);
  if (!explorer.isAllowedFile(filename)) {
    const allowed = [...ALLOWED_EXTENSIONS].join(', ');
    return res.status(400).json({
      error: `Format file tidak didukung. Hanya: ${allowed}`,
      filename,
    });
  }

  try {
    const parentDir = path.dirname(fullPath);
    fs.mkdirSync(parentDir, { recursive: true, mode: 0o777 });
    try {
      fs.chmodSync(parentDir, 0o777);
    } catch {}

    // Hapus file lama terlebih dahulu jika sudah ada (mencegah EACCES jika file lama dimiliki UID container)
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
    }

    const writeStream = fs.createWriteStream(fullPath, { mode: 0o666 });
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      try {
        fs.chmodSync(fullPath, 0o666);
      } catch {}
      if (!res.headersSent) {
        res.status(201).json({ success: true, path: relPath });
      }
    });

    writeStream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── Main: Auto-Discovery Directory & File Handler ──────────────────────────
app.all('{*path}', async (req: Request, res: Response) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  const sortKey = (req.query.sort as string) || 'name';
  const sortOrder = (req.query.order as string) || 'asc';

  try {
    const result = await explorer.discover(req.path, sortKey, sortOrder);
    const opts = { serverHost: DISPLAY_HOST, serverPort: PORT };

    if (result.type === 'not_found') {
      if (req.query.format === 'json' || wantsJson(req)) {
        return res.status(404).json({ error: 'Not Found', path: req.path });
      }
      return res.status(404).send(renderNotFoundHtml(req.path, opts));
    }

    if (result.type === 'forbidden') {
      if (req.query.format === 'json' || wantsJson(req)) {
        return res.status(403).json({ error: 'Forbidden', path: req.path });
      }
      return res.status(403).send(renderForbiddenHtml(req.path, opts));
    }

    // File → serve with correct MIME type
    if (result.type === 'file') {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', result.item.mimeType);
      return res.sendFile(result.fullPath, {
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Type': result.item.mimeType,
        },
      });
    }

    // Directory → auto-discovery listing
    if (result.type === 'directory') {
      // Enforce trailing slash
      if (!req.path.endsWith('/')) {
        const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        return res.redirect(301, req.path + '/' + query);
      }

      if (req.query.format === 'json' || wantsJson(req)) {
        return res.json(result.listing);
      }

      const isCli = isTerminalClient(req);
      const acceptsHtml = (req.headers.accept || '').includes('text/html');
      if (req.query.format === 'text' || (isCli && !acceptsHtml)) {
        return res.type('text/plain; charset=utf-8').send(renderAsciiDirectoryListing(result.listing, opts));
      }

      return res
        .type('text/html; charset=utf-8')
        .send(renderHtmlDirectoryListing(result.listing, { ...opts, title: TITLE, isAdmin: isAuthenticated(req.headers.cookie) }));
    }
  } catch (err: any) {
    console.error('[Error]', err.message, err);
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

function wantsJson(req: Request): boolean {
  return req.accepts('json') !== false && !req.accepts('html');
}

function isTerminalClient(req: Request): boolean {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return ua.startsWith('curl/') || ua.startsWith('wget/') || ua.startsWith('httpie/') || ua.includes('libcurl');
}

// ─── Start Server ────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  const allowed = [...ALLOWED_EXTENSIONS].join(', ');
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════╗
║             SWIRL-MIRROR REPOSITORY • AUTO-DISCOVERY                             ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ Server aktif di   : http://${DISPLAY_HOST}:${PORT}/                                       ║
║ Folder repositori : ${STORAGE_DIR}             ║
║ Runtime           : Bun ${Bun.version}                                                    ║
║ Mode              : Real-Time Auto-Discovery                                     ║
╚══════════════════════════════════════════════════════════════════════════════════╝
`);
});

process.on('SIGINT', () => {
  console.log('\n[swirl-mirror] Mematikan server...');
  server.close(() => {
    console.log('[swirl-mirror] Server berhenti.');
    process.exit(0);
  });
});