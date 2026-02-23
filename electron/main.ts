import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import os from 'os';
import Store from 'electron-store';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// electron/dist/ → project root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const store = new Store<{ dataFolder: string }>({
  name: 'cardstock-config',
});

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let serverPort = 3001;
const appIcon = path.join(PROJECT_ROOT, 'electron', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

// --- Cross-platform Chrome binary discovery ---

function findChromeBinary(baseDir: string): string | null {
  if (!fs.existsSync(baseDir)) return null;
  const builds = fs.readdirSync(baseDir);
  if (builds.length === 0) return null;

  const version = builds[0];
  let chromePath: string;

  if (process.platform === 'darwin') {
    chromePath = path.join(
      baseDir, version,
      'chrome-mac-x64',
      'Google Chrome for Testing.app',
      'Contents', 'MacOS', 'Google Chrome for Testing'
    );
  } else {
    chromePath = path.join(baseDir, version, 'chrome-win64', 'chrome.exe');
  }

  return fs.existsSync(chromePath) ? chromePath : null;
}

// --- Port detection ---

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(() => resolve(true)); });
    srv.listen(port, '127.0.0.1');
  });
}

async function findFreePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + 19}`);
}

// --- Data folder selection ---

async function pickDataFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose Cardstock Data Folder',
    message: 'Select a folder where your games, artwork, and exports will be stored.',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

function getBundledTemplatesDir(): string {
  if (isDev) {
    return path.join(PROJECT_ROOT, 'server', 'templates');
  }
  return path.join(process.resourcesPath!, 'templates');
}

function seedTemplates(dataFolder: string): void {
  const destDir = path.join(dataFolder, 'templates');
  // Check if templates folder already has subdirectories (user content)
  const existing = fs.readdirSync(destDir).filter((entry) =>
    fs.statSync(path.join(destDir, entry)).isDirectory()
  );
  if (existing.length > 0) return; // Don't overwrite user content

  const srcDir = getBundledTemplatesDir();
  if (!fs.existsSync(srcDir)) return;

  // Copy each template folder recursively
  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    if (!fs.statSync(srcPath).isDirectory()) continue;
    fs.cpSync(srcPath, path.join(destDir, entry), { recursive: true });
  }
}

function getDefaultDataFolder(): string {
  return path.join(os.homedir(), 'Documents', 'Cardstock');
}

function setupDataFolder(folderPath: string): void {
  for (const sub of ['games', 'output', 'templates']) {
    fs.mkdirSync(path.join(folderPath, sub), { recursive: true });
  }
  seedTemplates(folderPath);
}

function showWelcomeScreen(): Promise<string> {
  // Hide splash while welcome screen is showing
  splashWindow?.hide();

  return new Promise<string>((resolve, reject) => {
    const iconPath = appIcon;
    const welcomeWin = new BrowserWindow({
      width: 520,
      height: 440,
      frame: false,
      resizable: false,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    let resolved = false;

    ipcMain.handle('welcome-done', (_event, folderPath: string) => {
      if (!resolved) {
        resolved = true;
        welcomeWin.close();
        splashWindow?.show();
        resolve(folderPath);
      }
    });

    welcomeWin.on('closed', () => {
      ipcMain.removeHandler('welcome-done');
      if (!resolved) {
        reject(new Error('No data folder selected'));
      }
    });

    welcomeWin.loadFile(path.join(PROJECT_ROOT, 'electron', 'welcome.html'));
  });
}

async function ensureDataFolder(): Promise<string> {
  let dataFolder = store.get('dataFolder');

  if (!dataFolder || !fs.existsSync(dataFolder)) {
    try {
      dataFolder = await showWelcomeScreen();
    } catch {
      app.quit();
      throw new Error('No data folder selected');
    }
  }

  // Ensure subdirectories exist
  setupDataFolder(dataFolder);

  return dataFolder;
}

// --- IPC: allow renderer to request folder change ---

ipcMain.handle('get-data-folder', () => store.get('dataFolder'));

ipcMain.handle('get-default-data-folder', () => getDefaultDataFolder());

ipcMain.handle('pick-data-folder', async () => {
  const chosen = await pickDataFolder();
  return chosen;
});

ipcMain.handle('use-data-folder', (_event, folderPath: string) => {
  store.set('dataFolder', folderPath);
  setupDataFolder(folderPath);
  return folderPath;
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// --- Window controls (frameless) ---

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

// --- Splash window ---

function createSplash(): BrowserWindow {
  const iconPath = appIcon;
  const splash = new BrowserWindow({
    width: 360,
    height: 240,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    icon: iconPath,
    backgroundColor: '#1a1a2e',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      body {
        margin: 0; display: flex; align-items: center; justify-content: center;
        height: 100vh; background: #1a1a2e; color: #e0e0e0;
        font-family: 'Segoe UI', sans-serif;
        flex-direction: column; gap: 16px;
        -webkit-app-region: drag;
      }
      h1 { font-size: 28px; margin: 0; color: #7c5cbf; }
      p { font-size: 14px; opacity: 0.7; margin: 0; }
      .spinner {
        width: 32px; height: 32px; border: 3px solid #333;
        border-top-color: #7c5cbf; border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    </head>
    <body>
      <h1>Cardstock</h1>
      <div class="spinner"></div>
      <p>Starting server...</p>
    </body>
    </html>
  `)}`);

  return splash;
}

// --- Server startup ---

async function startServer(): Promise<void> {
  // Find a free port, set it for the server
  const sharedEntry = pathToFileURL(path.join(PROJECT_ROOT, 'shared', 'dist', 'index.js')).href;
  const { SERVER_PORT } = await import(sharedEntry);
  serverPort = await findFreePort(SERVER_PORT);
  process.env.PORT = String(serverPort);

  // Dynamic import — use pathToFileURL to avoid TS module resolution
  const serverEntry = pathToFileURL(path.join(PROJECT_ROOT, 'server', 'dist', 'index.js')).href;
  await import(serverEntry);

  // Poll until server is ready
  const url = `http://localhost:${serverPort}`;

  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url + '/api/templates');
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server failed to start within 30 seconds');
}

// --- Main window ---

function createMainWindow(): BrowserWindow {
  const iconPath = appIcon;

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Cardstock',
    icon: iconPath,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  return win;
}

// --- App lifecycle ---

app.whenReady().then(async () => {
  try {
    // 1. Show splash immediately to claim taskbar with correct icon
    splashWindow = createSplash();

    // 2. Pick data folder (may show welcome screen)
    const dataFolder = await ensureDataFolder();

    // 3. Set env vars for the server
    process.env.CARDMAKER_DATA_ROOT = dataFolder;
    process.env.CARDMAKER_OUTPUT_DIR = path.join(dataFolder, 'output');
    process.env.CARDMAKER_TEMPLATES_DIR = path.join(dataFolder, 'templates');

    if (isDev) {
      // Dev mode: client-dist in source tree
      process.env.CARDMAKER_CLIENT_DIST = path.join(PROJECT_ROOT, 'client-dist');

      // Dev mode: find Chrome for Testing downloaded by scripts/download-chrome.js
      if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
        const chromePath = findChromeBinary(path.join(PROJECT_ROOT, 'chrome', 'chrome'));
        if (chromePath) {
          process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
        }
      }
    } else {
      // Production
      process.env.CARDMAKER_CLIENT_DIST = path.join(PROJECT_ROOT, 'client-dist');
      // Chrome is in extraResources/chrome/chrome/<version>/<platform>/
      const chromePath = findChromeBinary(path.join(process.resourcesPath!, 'chrome', 'chrome'));
      if (chromePath) {
        process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
      }
    }

    // 4. Start the Express server
    await startServer();

    // 5. Create main window
    Menu.setApplicationMenu(null);
    mainWindow = createMainWindow();

    // Load from the Express server, which serves the built client as static files.
    // If you need Vite HMR for client development, run Vite separately and load
    // http://localhost:5173 instead.
    const loadUrl = `http://localhost:${serverPort}`;
    mainWindow.loadURL(loadUrl);

    mainWindow.once('ready-to-show', () => {
      splashWindow?.close();
      splashWindow = null;
      mainWindow?.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('Startup error:', err);
    dialog.showErrorBox('Startup Error', String(err));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    mainWindow.loadURL(`http://localhost:${serverPort}`);
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });
  }
});

app.on('before-quit', async () => {
  try {
    const rendererPath = pathToFileURL(path.join(PROJECT_ROOT, 'server', 'dist', 'services', 'renderer.js')).href;
    const { closeBrowser } = await import(rendererPath);
    await closeBrowser();
  } catch {
    // best effort
  }
});
