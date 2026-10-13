import type { DirectoryListing, RepoItem } from './types.ts';
import { ALLOWED_EXTENSIONS } from './explorer.ts';

const DEBIAN_SWIRL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 435" width="24" height="30" style="vertical-align: middle;">
  <path fill="#D70A53" d="M125.6 42.4c-22.3 8.3-43 23.3-57.8 42-17.7 22.4-27.1 50.8-26.6 79.1.5 32 13 63.3 34.6 86.8 21.8 23.8 52.4 38.6 84.4 41.2 30.6 2.5 61.9-7.5 86.1-26.6 23.4-18.4 38.9-45.5 42.7-75 3.8-29.4-4-59.9-21.7-83.6-17.2-23.1-43.1-38.6-71.7-43.3-26.2-4.3-53.7 2.1-75.5 16.9-19.4 13.1-32.9 33.7-37 56.8-4.2 23.4 2.8 48 18.5 65.6 15 16.9 37.4 26 59.8 24.3 20.8-1.5 40.5-12.7 51.7-30.4 10.1-16 12.3-36.2 6.1-54-4.8-13.8-15.1-25.2-28.3-31.5-11.9-5.7-25.9-6.3-38.3-1.8-10.7 3.9-19.5 12.2-24.1 22.6-4.2 9.5-4.3 20.6-.2 30.2 3.6 8.5 10.7 15.3 19.4 18.6 8.1 3 17.3 2.3 24.8-2 6.5-3.7 11.2-10.1 12.5-17.5 1.2-6.7-1.1-13.8-5.9-18.6-4.5-4.5-11.1-6.7-17.4-5.7-5.5.9-10.4 4.5-12.8 9.5-2.1 4.5-1.9 9.8.5 14.1 2.1 3.8 6.1 6.5 10.5 7.1 3.8.5 7.8-.8 10.4-3.5 2.2-2.3 3.1-5.7 2.4-8.8-.6-2.6-2.5-4.8-5-5.6-2.2-.7-4.7-.2-6.4 1.3-1.4 1.3-2 3.3-1.5 5.2.4 1.5 1.7 2.7 3.2 2.9 1.3.2 2.7-.4 3.4-1.5.5-.8.5-1.9 0-2.7-.4-.7-1.3-.9-2-.6-.5.2-.8.8-.6 1.3.1.3.5.5.8.4.2-.1.3-.4.2-.6-.1-.1-.3-.2-.4-.1-.1 0-.1.2-.1.3 0 0 0 .1.1.1h.1z"/>
</svg>`;

export function renderHtmlDirectoryListing(
  listing: DirectoryListing,
  options: {
    serverHost: string;
    serverPort: number | string;
    title?: string;
    isAdmin?: boolean;
  }
): string {
  const { currentPath, parentPath, breadcrumbs, items, totalDirs, totalFiles, formattedTotalSize } = listing;
  const title = options.title || 'Debian File Repository';
  const isAdmin = options.isAdmin ?? false;

  const breadcrumbsHtml = breadcrumbs
    .map((crumb, idx) => {
      const isLast = idx === breadcrumbs.length - 1;
      if (isLast) {
        return `<span class="breadcrumb-item active">${escapeHtml(crumb.name)}</span>`;
      }
      return `<a class="breadcrumb-item" href="${crumb.path}">${escapeHtml(crumb.name)}</a>`;
    })
    .join(' <span class="sep">/</span> ');

  const hostUrl = `http://${options.serverHost}${options.serverPort === 80 ? '' : `:${options.serverPort}`}`;
  const allowedList = [...ALLOWED_EXTENSIONS].map(e => e.replace('.', '').toUpperCase()).join(', ');
  const acceptAttr = [...ALLOWED_EXTENSIONS].join(',');

  // Render items rows
  const rowsHtml: string[] = [];

  if (parentPath !== null) {
    rowsHtml.push(`
      <tr class="item-row item-parent">
        <td class="col-icon"><span class="badge badge-dir">[DIR]</span></td>
        <td class="col-name"><a href="${parentPath}" class="parent-link">Parent Directory</a></td>
        <td class="col-date">-</td>
        <td class="col-size">-</td>
        <td class="col-actions"></td>
      </tr>
    `);
  }

  for (const item of items) {
    const badgeClass = `badge badge-${item.icon}`;
    const badgeText = item.icon.toUpperCase();

    let actionsHtml = '';
    if (!item.isDirectory) {
      actionsHtml += `<a href="${item.relPath}" download title="Unduh ${escapeHtml(item.name)}" class="btn-action">Unduh</a>`;
    }
    actionsHtml += `<button class="btn-action btn-copy" onclick="copyUrl('${hostUrl}${item.relPath}', this)" title="Salin URL">Salin URL</button>`;
    if (isAdmin) {
      actionsHtml += `<button class="btn-action btn-delete" data-path="${escapeHtml(item.relPath)}" data-name="${escapeHtml(item.name)}" data-isdir="${item.isDirectory ? '1' : '0'}" onclick="deleteItem(this)" title="Hapus ${escapeHtml(item.name)}">Hapus</button>`;
    }

    const nameLink = item.icon === 'image'
      ? `<a href="${item.relPath}" class="link-file link-image" style="--preview-url:url(${item.relPath})">${escapeHtml(item.name)}</a>`
      : `<a href="${item.relPath}" class="${item.isDirectory ? 'link-dir' : 'link-file'}">${escapeHtml(item.name)}</a>`;

    rowsHtml.push(`
      <tr class="item-row item-${item.isDirectory ? 'dir' : 'file'}" data-name="${escapeHtml(item.name.toLowerCase())}">
        <td class="col-icon"><span class="${badgeClass}">[${badgeText}]</span></td>
        <td class="col-name">${nameLink}</td>
        <td class="col-date">${item.mtimeFormatted}</td>
        <td class="col-size">${item.formattedSize}</td>
        <td class="col-actions">${actionsHtml}</td>
      </tr>
    `);
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Index of ${escapeHtml(currentPath)} - ${escapeHtml(title)}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(DEBIAN_SWIRL_SVG).toString('base64')}">
  <style>
    :root {
      --debian-red: #D70A53;
      --debian-dark-red: #A80030;
      --bg: #ffffff;
      --fg: #222222;
      --border: #dddddd;
      --row-hover: #f5f5f7;
      --row-alt: #fafafa;
      --link: #0044cc;
      --link-hover: #D70A53;
      --code-bg: #f4f4f4;
      --badge-dir: #0066cc;
      --badge-image: #fd7e14;
      --badge-video: #dc3545;
      --badge-doc: #0d6efd;
      --badge-pdf: #e63946;
      --badge-text: #28a745;
      --badge-iso: #6f42c1;
      --badge-dmg: #845ec2;
      --badge-ova: #0891b2;
      --badge-archive: #b056ff;
      --badge-file: #6c757d;
      --font-mono: 'DejaVu Sans Mono', 'Ubuntu Mono', 'SF Mono', Consolas, Monaco, monospace;
    }

    @media (prefers-color-scheme: dark) {
      :root[data-theme="auto"], :root[data-theme="dark"] {
        --bg: #18191a;
        --fg: #e4e6eb;
        --border: #3a3b3c;
        --row-hover: #242526;
        --row-alt: #1e1f20;
        --link: #58a6ff;
        --link-hover: #ff4d88;
        --code-bg: #2d2f31;
        --badge-dir: #58a6ff;
        --badge-image: #ffa657;
        --badge-video: #ff6b6b;
        --badge-doc: #70a1ff;
        --badge-pdf: #ff7675;
        --badge-text: #3fb950;
        --badge-iso: #a371f7;
        --badge-dmg: #b39ddb;
        --badge-ova: #22d3ee;
        --badge-archive: #c084fc;
        --badge-file: #8b949e;
      }
    }

    :root[data-theme="light"] {
      --bg: #ffffff; --fg: #222222; --border: #dddddd;
      --row-hover: #f5f5f7; --row-alt: #fafafa;
      --link: #0044cc; --link-hover: #D70A53; --code-bg: #f4f4f4;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-mono);
      font-size: 14px;
      line-height: 1.5;
      padding: 16px 24px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      border-bottom: 2px solid var(--debian-red);
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }

    .brand h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }
    .brand-debian { color: var(--debian-red); }

    .top-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      background: var(--code-bg);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 5px 11px;
      border-radius: 4px;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s, border-color 0.2s;
    }

    .btn:hover { background: var(--border); }

    .btn-primary {
      background: var(--debian-red);
      border-color: var(--debian-dark-red);
      color: #ffffff;
      font-weight: 600;
    }

    .btn-primary:hover { background: var(--debian-dark-red); }

    .btn-login {
      background: #0066cc;
      border-color: #0052a3;
      color: #ffffff;
      font-weight: 600;
    }

    .btn-login:hover { background: #0052a3; }

    .btn-logout {
      background: #495057;
      border-color: #343a40;
      color: #ffffff;
      font-weight: 600;
    }

    .btn-logout:hover { background: #343a40; }

    .breadcrumbs-bar {
      margin-top: 10px;
      padding: 8px 12px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 13px;
    }

    .breadcrumbs-bar a { color: var(--link); text-decoration: none; font-weight: 600; }
    .breadcrumbs-bar a:hover { color: var(--link-hover); text-decoration: underline; }
    .breadcrumbs-bar .sep { color: var(--border); margin: 0 4px; }
    .breadcrumbs-bar .active { font-weight: 700; color: var(--fg); }

    /* Upload progress */
    .upload-progress {
      display: none;
      margin-bottom: 12px;
      padding: 10px 14px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
    }

    .upload-progress.active { display: block; }

    .progress-bar {
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 6px;
    }

    .progress-fill {
      height: 100%;
      background: var(--debian-red);
      width: 0%;
      transition: width 0.3s;
      border-radius: 3px;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .search-box {
      flex: 1;
      min-width: 250px;
      max-width: 450px;
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 7px 12px 7px 32px;
      font-family: inherit;
      font-size: 13px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--code-bg);
      color: var(--fg);
      outline: none;
    }

    .search-input:focus {
      border-color: var(--debian-red);
      box-shadow: 0 0 0 2px rgba(215, 10, 83, 0.2);
    }

    .search-icon {
      position: absolute; left: 10px; top: 50%;
      transform: translateY(-50%); font-size: 13px; color: #888;
    }

    .repo-stats { font-size: 12px; color: #777; }

    /* Table */
    .table-container {
      width: 100%;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg);
      margin-bottom: 20px;
    }

    table { width: 100%; border-collapse: collapse; text-align: left; }

    th {
      background: var(--code-bg);
      padding: 8px 12px;
      font-weight: 700;
      font-size: 12px;
      border-bottom: 2px solid var(--border);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    th a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
    th a:hover { color: var(--debian-red); }

    td { padding: 7px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:nth-child(even) { background-color: var(--row-alt); }
    tr:hover { background-color: var(--row-hover); }

    .col-icon { width: 60px; text-align: center; }
    .col-name { min-width: 220px; }
    .col-date { width: 160px; white-space: nowrap; color: #666; font-size: 12px; }
    .col-size { width: 100px; text-align: right; white-space: nowrap; font-size: 12px; }
    .col-actions { width: 220px; text-align: right; white-space: nowrap; }

    .link-dir { font-weight: 700; color: var(--link); text-decoration: none; }
    .link-file { color: var(--link); text-decoration: none; }
    .link-dir:hover, .link-file:hover, .parent-link:hover { color: var(--link-hover); text-decoration: underline; }
    .parent-link { color: var(--link); text-decoration: none; font-weight: 600; }

    /* Image preview on hover */
    .link-image { position: relative; }
    .link-image:hover::after {
      content: '';
      position: absolute;
      left: 0; top: 100%;
      width: 200px; height: 150px;
      background-image: var(--preview-url);
      background-size: contain;
      background-repeat: no-repeat;
      background-color: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 100;
      pointer-events: none;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 1px 5px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 3px;
      letter-spacing: -0.5px;
    }

    .badge-dir   { background: rgba(0,102,204,0.15);  color: var(--badge-dir); }
    .badge-image { background: rgba(253,126,20,0.15);  color: var(--badge-image); }
    .badge-video { background: rgba(220,53,69,0.15);   color: var(--badge-video); }
    .badge-doc   { background: rgba(13,110,253,0.15);  color: var(--badge-doc); }
    .badge-pdf   { background: rgba(230,57,70,0.15);   color: var(--badge-pdf); }
    .badge-text  { background: rgba(40,167,69,0.15);   color: var(--badge-text); }
    .badge-iso     { background: rgba(111,66,193,0.15);  color: var(--badge-iso); }
    .badge-dmg     { background: rgba(132,94,194,0.15);  color: var(--badge-dmg); }
    .badge-ova     { background: rgba(8,145,178,0.15);   color: var(--badge-ova); }
    .badge-archive { background: rgba(176,86,255,0.15);  color: var(--badge-archive); }
    .badge-file    { background: rgba(108,117,125,0.15); color: var(--badge-file); }

    .btn-action {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: var(--code-bg);
      color: var(--fg);
      cursor: pointer;
      text-decoration: none;
      margin-left: 4px;
    }

    .btn-action:hover { background: var(--border); }

    .btn-delete {
      color: var(--debian-red);
      border-color: rgba(215, 10, 83, 0.35);
    }

    .btn-delete:hover {
      background: var(--debian-red);
      border-color: var(--debian-dark-red);
      color: #ffffff;
    }

    /* Footer */
    footer {
      margin-top: auto;
      border-top: 1px solid var(--border);
      padding-top: 14px;
      font-size: 12px;
      color: #777;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .footer-left { display: flex; align-items: center; gap: 6px; }
    .footer-server { font-style: italic; }

    /* Toast */
    #toast {
      position: fixed;
      bottom: 24px; right: 24px;
      background: #242526; color: #fff;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: none;
      z-index: 1000;
    }
    #toast.show { opacity: 1; transform: translateY(0); }

    /* Classic Debian view mode */
    body.classic-mode {
      background: #ffffff !important;
      color: #000000 !important;
      font-family: monospace;
      padding: 10px;
    }
    body.classic-mode header { border-bottom: none; }
    body.classic-mode .upload-progress,
    body.classic-mode .toolbar,
    body.classic-mode .col-actions { display: none; }
    body.classic-mode .table-container { border: none; background: transparent; }
    body.classic-mode table { border-collapse: separate; }
    body.classic-mode th { background: transparent; border-top: 1px solid #000; border-bottom: 1px solid #000; }
    body.classic-mode td { border-bottom: none; padding: 2px 8px; }
    body.classic-mode tr:nth-child(even) { background: transparent; }
    body.classic-mode tr:hover { background: #eee; }
    body.classic-mode footer { border-top: 1px solid #000; margin-top: 20px; }
  </style>
</head>
<body>
  <header>
    <div class="header-top">
      <a href="/" class="brand">
        ${DEBIAN_SWIRL_SVG}
        <h1>Index of <span class="brand-debian">${escapeHtml(currentPath)}</span></h1>
      </a>
      <div class="top-controls">
        ${isAdmin ? `
        <button class="btn btn-primary" onclick="triggerFileUpload()" title="Unggah berkas (${allowedList})">+ Unggah Berkas</button>
        <button class="btn" onclick="createNewFolder()" title="Buat folder baru">+ Folder Baru</button>` : ''}
        <a href="?format=json" class="btn" title="Lihat dalam format JSON API">JSON</a>
        <a href="?format=text" class="btn" title="Lihat dalam format teks biasa">Raw Text</a>
        <button class="btn" id="themeToggle" onclick="toggleTheme()" title="Ganti Mode Gelap/Terang">&#x1F313; Tema</button>
        <button class="btn" id="modeToggle" onclick="toggleClassicMode()" title="Ganti Tampilan Klasik/Modern">&#x1F5A5;&#xFE0F; Klasik</button>
        ${isAdmin
          ? `<a href="/auth/logout" class="btn btn-logout" title="Logout Admin">&#x1F511; Logout</a>`
          : `<a href="/login" class="btn btn-login" title="Login sebagai Admin">&#x1F511; Login Admin</a>`
        }
      </div>
    </div>
    <div class="breadcrumbs-bar">
      Navigasi: ${breadcrumbsHtml}
    </div>
  </header>

  ${isAdmin ? `<input type="file" id="fileUploadInput" accept="${acceptAttr}" style="display:none" onchange="handleFileSelected(event)">` : ''}

  <div class="upload-progress" id="uploadProgress">
    <span id="uploadFileName">Mengunggah...</span>
    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
  </div>

  <div class="toolbar">
    <div class="search-box">
      <span class="search-icon">&#x1F50D;</span>
      <input type="text" id="searchInput" class="search-input" placeholder="Cari berkas atau folder... (tekan /)" onkeyup="filterItems()">
    </div>
    <div class="repo-stats">
      <span id="itemCount">${totalDirs} direktori, ${totalFiles} berkas</span> &bull; Total: <strong>${formattedTotalSize}</strong>
    </div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="col-icon">Tipe</th>
          <th class="col-name"><a href="?sort=name">Nama</a></th>
          <th class="col-date"><a href="?sort=date">Terakhir Diubah</a></th>
          <th class="col-size"><a href="?sort=size">Ukuran</a></th>
          <th class="col-actions">Aksi</th>
        </tr>
      </thead>
      <tbody id="itemsTable">
        ${rowsHtml.join('\n')}
      </tbody>
    </table>
  </div>

  <footer>
    <div class="footer-left">
      ${DEBIAN_SWIRL_SVG}
      <span class="footer-server">
        Apache/2.4.62 (Debian) Server at <strong>${escapeHtml(options.serverHost)}</strong> Port <strong>${options.serverPort}</strong>
      </span>
    </div>
    <div>
      <span>swirl-mirror &bull; Auto-Discovery File &amp; Folder</span>
    </div>
  </footer>

  <div id="toast"></div>

  <script>
    const currentDirectory = "${escapeHtml(currentPath)}";
    const allowedExtensions = ${JSON.stringify([...ALLOWED_EXTENSIONS])};

    function copyUrl(text, btn) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Disalin: ' + text);
        if (btn) {
          var orig = btn.innerText;
          btn.innerText = 'Tersalin!';
          setTimeout(function() { btn.innerText = orig; }, 1500);
        }
      }).catch(function(err) { showToast('Gagal menyalin: ' + err); });
    }

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }

    function filterItems() {
      var q = document.getElementById('searchInput').value.toLowerCase().trim();
      var rows = document.querySelectorAll('.item-row:not(.item-parent)');
      var visible = 0;
      rows.forEach(function(row) {
        var name = row.getAttribute('data-name') || '';
        if (name.includes(q)) { row.style.display = ''; visible++; }
        else { row.style.display = 'none'; }
      });
      document.getElementById('itemCount').innerText = visible + ' berkas/folder ditemukan';
    }

    window.addEventListener('keydown', function(e) {
      if (e.key === '/' && document.activeElement !== document.getElementById('searchInput')) {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
    });

    function isAllowedFile(filename) {
      var ext = '.' + filename.split('.').pop().toLowerCase();
      return allowedExtensions.indexOf(ext) !== -1;
    }

    function triggerFileUpload() { document.getElementById('fileUploadInput').click(); }

    function uploadFile(file) {
      if (!isAllowedFile(file.name)) {
        showToast('Format tidak didukung: ' + file.name + '. Hanya ' + allowedExtensions.join(', '));
        return;
      }

      var basePath = currentDirectory.split('/').map(encodeURIComponent).join('/');
      var encodedFileName = encodeURIComponent(file.name);
      var targetUrl = basePath.endsWith('/') ? basePath + encodedFileName : basePath + '/' + encodedFileName;
      var progressEl = document.getElementById('uploadProgress');
      var fillEl = document.getElementById('progressFill');
      var nameEl = document.getElementById('uploadFileName');
      progressEl.classList.add('active');
      nameEl.innerText = 'Mengunggah: ' + file.name;
      fillEl.style.width = '0%';

      var xhr = new XMLHttpRequest();
      xhr.open('PUT', targetUrl);

      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          fillEl.style.width = Math.round((e.loaded / e.total) * 100) + '%';
        }
      });

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          showToast('Berhasil mengunggah: ' + file.name);
          setTimeout(function() { window.location.reload(); }, 600);
        } else {
          var errMsg = xhr.statusText;
          try {
            var resData = JSON.parse(xhr.responseText);
            if (resData && resData.error) errMsg = resData.error;
          } catch (e) {}
          showToast('Gagal mengunggah: ' + (errMsg || 'Error ' + xhr.status));
        }
        setTimeout(function() { progressEl.classList.remove('active'); }, 2000);
      };

      xhr.onerror = function() {
        showToast('Kesalahan jaringan');
        setTimeout(function() { progressEl.classList.remove('active'); }, 2000);
      };

      xhr.send(file);
    }

    function handleFileSelected(event) {
      var file = event.target.files[0];
      if (file) uploadFile(file);
      event.target.value = '';
    }

    // Drag & Drop (bisa lepas file langsung ke halaman browser)
    document.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.addEventListener('drop', function(e) {
      e.preventDefault();
      var files = e.dataTransfer.files;
      if (files.length > 0) uploadFile(files[0]);
    });

    function createNewFolder() {
      var name = prompt('Masukkan nama folder baru:');
      if (!name) return;
      var clean = name.trim().replace(/[\\\\\\/]/g, '');
      if (!clean) return;

      var targetPath = currentDirectory.endsWith('/') ? currentDirectory + clean : currentDirectory + '/' + clean;

      fetch('/api/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      }).then(function(res) {
        return res.json().then(function(data) {
          if (res.ok) {
            showToast('Folder "' + clean + '" berhasil dibuat!');
            setTimeout(function() { window.location.reload(); }, 600);
          } else {
            showToast('Gagal: ' + (data.error || res.statusText));
          }
        });
      }).catch(function(err) {
        showToast('Kesalahan: ' + err.message);
      });
    }

    function deleteItem(btn) {
      var targetPath = btn.getAttribute('data-path');
      var itemName = btn.getAttribute('data-name') || targetPath;
      var isDir = btn.getAttribute('data-isdir') === '1';
      if (!targetPath) return;

      var confirmMsg = isDir
        ? 'Apakah Anda yakin ingin menghapus folder "' + itemName + '" beserta seluruh isinya?'
        : 'Apakah Anda yakin ingin menghapus berkas "' + itemName + '"?';

      if (!confirm(confirmMsg)) return;

      btn.disabled = true;
      var origText = btn.innerText;
      btn.innerText = 'Menghapus...';

      var encodedPath = targetPath.split('/').map(encodeURIComponent).join('/');

      fetch(encodedPath, {
        method: 'DELETE'
      }).then(function(res) {
        return res.json().then(function(data) {
          if (res.ok) {
            showToast((isDir ? 'Folder "' : 'Berkas "') + itemName + '" berhasil dihapus!');
            var row = btn.closest('tr');
            if (row) {
              row.style.opacity = '0.3';
              row.style.transition = 'opacity 0.3s';
            }
            setTimeout(function() { window.location.reload(); }, 500);
          } else {
            btn.disabled = false;
            btn.innerText = origText;
            showToast('Gagal menghapus: ' + (data.error || res.statusText));
          }
        });
      }).catch(function(err) {
        btn.disabled = false;
        btn.innerText = origText;
        showToast('Kesalahan: ' + err.message);
      });
    }

    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme') || 'auto';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('repo-theme', next);
    }

    function toggleClassicMode() {
      var isClassic = document.body.classList.toggle('classic-mode');
      localStorage.setItem('repo-classic', isClassic ? 'true' : 'false');
      document.getElementById('modeToggle').innerHTML = isClassic ? '&#x1F3A8; Modern' : '&#x1F5A5;&#xFE0F; Klasik';
    }

    (function() {
      var saved = localStorage.getItem('repo-theme');
      if (saved) document.documentElement.setAttribute('data-theme', saved);
      if (localStorage.getItem('repo-classic') === 'true') {
        document.body.classList.add('classic-mode');
        document.getElementById('modeToggle').innerHTML = '&#x1F3A8; Modern';
      }
    })();
  </script>
</body>
</html>`;
}

export function renderAsciiDirectoryListing(
  listing: DirectoryListing,
  options: { serverHost: string; serverPort: number | string }
): string {
  const { currentPath, parentPath, items, totalDirs, totalFiles, formattedTotalSize } = listing;
  const sep = '='.repeat(78);
  const dash = '-'.repeat(78);

  let out = 'Index of ' + currentPath + '\n';
  out += sep + '\n';
  out += 'Type'.padEnd(7) + 'Name'.padEnd(38) + 'Last Modified'.padEnd(20) + 'Size'.padStart(10) + '\n';
  out += dash + '\n';

  if (parentPath !== null) {
    out += '[DIR]  ' + '../'.padEnd(38) + '-'.padEnd(20) + '-'.padStart(10) + '\n';
  }

  for (const item of items) {
    const typeTag = ('[' + item.icon.toUpperCase().slice(0, 3) + ']').padEnd(7);
    const name = item.name.length > 36 ? item.name.slice(0, 33) + '...' : item.name;
    out += typeTag + name.padEnd(38) + item.mtimeFormatted.padEnd(20) + item.formattedSize.padStart(10) + '\n';
  }

  out += sep + '\n';
  out += 'Apache/2.4.62 (Debian) Server at ' + options.serverHost + ' Port ' + options.serverPort + '\n';
  out += 'Total: ' + totalDirs + ' directories, ' + totalFiles + ' files (' + formattedTotalSize + ')\n';

  return out;
}

export function renderNotFoundHtml(requestPath: string, options: { serverHost: string; serverPort: number | string }): string {
  const p = escapeHtml(requestPath);
  const h = escapeHtml(options.serverHost);
  return '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html>\n<head><title>404 Not Found</title>\n<style>body{font-family:monospace;padding:20px}h1{color:#D70A53}hr{border:0;border-top:1px solid #aaa}address{font-size:12px;color:#555}a{color:#0044cc;text-decoration:none}a:hover{text-decoration:underline}</style>\n</head>\n<body>\n<h1>Not Found</h1>\n<p>The requested URL <code>' + p + '</code> was not found on this server.</p>\n<p><a href="/">&larr; Kembali ke Index</a></p>\n<hr>\n<address>Apache/2.4.62 (Debian) Server at ' + h + ' Port ' + options.serverPort + '</address>\n</body>\n</html>';
}

export function renderForbiddenHtml(requestPath: string, options: { serverHost: string; serverPort: number | string }): string {
  const p = escapeHtml(requestPath);
  const h = escapeHtml(options.serverHost);
  return '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html>\n<head><title>403 Forbidden</title>\n<style>body{font-family:monospace;padding:20px}h1{color:#D70A53}hr{border:0;border-top:1px solid #aaa}address{font-size:12px;color:#555}a{color:#0044cc;text-decoration:none}</style>\n</head>\n<body>\n<h1>Forbidden</h1>\n<p>You don\'t have permission to access <code>' + p + '</code> on this server.</p>\n<p><a href="/">&larr; Kembali ke Index</a></p>\n<hr>\n<address>Apache/2.4.62 (Debian) Server at ' + h + ' Port ' + options.serverPort + '</address>\n</body>\n</html>';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderLoginPage(options: {
  serverHost: string;
  serverPort: number | string;
  title?: string;
  error?: string;
  redirect?: string;
}): string {
  const title = escapeHtml(options.title || 'Login Admin');
  const host = escapeHtml(options.serverHost);
  const error = options.error ? escapeHtml(options.error) : '';
  const redirect = options.redirect ? escapeHtml(options.redirect) : '/';

  const SWIRL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="64" height="64"><circle cx="50" cy="50" r="48" fill="#D70A53"/><path d="M50 15 C30 15,15 30,15 50 C15 65,25 78,39 83 C28 76,22 64,22 52 C22 35,35 22,52 22 C62 22,71 27,76 35 C71 24,61 15,50 15 Z" fill="white"/><circle cx="50" cy="52" r="10" fill="white"/></svg>';

  return '<!DOCTYPE html>\n' +
    '<html lang="id">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + title + ' — Debian File Repository</title>\n' +
    '<style>\n' +
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n' +
    'body { font-family: "DejaVu Sans Mono", "Courier New", monospace; background: #f5f5f5; min-height: 100vh; display: flex; flex-direction: column; }\n' +
    '.top-bar { background: #D70A53; color: white; padding: 8px 20px; font-size: 13px; display: flex; align-items: center; gap: 10px; }\n' +
    '.top-bar svg { flex-shrink: 0; }\n' +
    '.top-bar span { font-weight: bold; letter-spacing: 0.5px; }\n' +
    '.main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 16px; }\n' +
    '.card { background: white; border: 1px solid #ccc; border-top: 4px solid #D70A53; border-radius: 4px; width: 100%; max-width: 400px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }\n' +
    '.card-header { text-align: center; margin-bottom: 28px; }\n' +
    '.card-header .logo { margin-bottom: 12px; }\n' +
    '.card-header h1 { font-size: 20px; color: #222; margin-bottom: 4px; }\n' +
    '.card-header p { font-size: 12px; color: #666; }\n' +
    '.form-group { margin-bottom: 16px; }\n' +
    'label { display: block; font-size: 12px; font-weight: bold; color: #444; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }\n' +
    'input[type=text], input[type=password] { width: 100%; padding: 9px 12px; border: 1px solid #ccc; border-radius: 3px; font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.2s; }\n' +
    'input[type=text]:focus, input[type=password]:focus { border-color: #D70A53; box-shadow: 0 0 0 2px rgba(215,10,83,0.15); }\n' +
    '.btn-submit { width: 100%; padding: 10px; background: #D70A53; color: white; border: none; border-radius: 3px; font-family: inherit; font-size: 14px; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-top: 8px; }\n' +
    '.btn-submit:hover { background: #b5083f; }\n' +
    '.error-box { background: #fff0f3; border: 1px solid #f5c2cc; border-left: 4px solid #D70A53; border-radius: 3px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #8b0000; }\n' +
    '.back-link { text-align: center; margin-top: 20px; font-size: 12px; }\n' +
    '.back-link a { color: #0044cc; text-decoration: none; }\n' +
    '.back-link a:hover { text-decoration: underline; }\n' +
    'footer { text-align: center; padding: 12px; font-size: 11px; color: #888; border-top: 1px solid #ddd; background: #fafafa; }\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div class="top-bar">' + SWIRL + '<span>Debian File Repository — Panel Admin</span></div>\n' +
    '<div class="main">\n' +
    '<div class="card">\n' +
    '<div class="card-header">\n' +
    '<div class="logo">' + SWIRL + '</div>\n' +
    '<h1>Login Admin</h1>\n' +
    '<p>Masuk untuk mengelola repositori</p>\n' +
    '</div>\n' +
    (error ? '<div class="error-box">⚠ ' + error + '</div>\n' : '') +
    '<form method="POST" action="/auth/login" autocomplete="off">\n' +
    '<input type="hidden" name="redirect" value="' + redirect + '">\n' +
    '<div class="form-group">\n' +
    '<label for="username">Nama Pengguna</label>\n' +
    '<input type="text" id="username" name="username" placeholder="admin" required autofocus>\n' +
    '</div>\n' +
    '<div class="form-group">\n' +
    '<label for="password">Kata Sandi</label>\n' +
    '<input type="password" id="password" name="password" placeholder="••••••••" required>\n' +
    '</div>\n' +
    '<button type="submit" class="btn-submit">🔐 Masuk</button>\n' +
    '</form>\n' +
    '<div class="back-link"><a href="/">← Kembali ke Repositori</a></div>\n' +
    '</div>\n' +
    '</div>\n' +
    '<footer>Apache/2.4.62 (Debian) Server at ' + host + ' Port ' + options.serverPort + '</footer>\n' +
    '</body>\n' +
    '</html>';
}
