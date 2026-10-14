import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Default values used when no user config file exists yet. The user can
// override these by editing the JSON file at app.getPath('userData')/config.json.
const DEFAULT_CONFIG = { idleTimeoutMin: 5, intervalMs: 1000 }

function configPath() {
  return join(app.getPath('userData'), 'config.json')
}

// Read the user's config file, falling back to DEFAULT_CONFIG for any missing
// fields. Writes the default file on first run so the user has something to edit.
function loadConfig() {
  const path = configPath()
  let userConfig = {}
  if (existsSync(path)) {
    try {
      userConfig = JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      userConfig = {}
    }
  } else {
    writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2))
  }
  return { ...DEFAULT_CONFIG, ...userConfig }
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Allow opening DevTools with F12 in the packaged app too. The toolkit's
  // watchWindowShortcuts only wires F12 up in development, so handle it here
  // explicitly for production builds.
  if (!is.dev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.code === 'F12') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools({ mode: 'undocked' })
        }
      }
    })
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Serve the user-editable configuration to the renderer.
  ipcMain.handle('config:get', () => loadConfig())

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
