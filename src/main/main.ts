import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registrarHandlersAuth, registrarHandlersCadastros } from './ipc';

class AppWindowManager {
  private mainWindow: BrowserWindow | null = null;

  public init(): void {
    app.whenReady().then(() => {
      registrarHandlersAuth();
      registrarHandlersCadastros();
      this.createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1100,
      height: 720,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#121214',
      title: 'Ink & Glow Studio',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, '../preload/preload.js')
      }
    });

    // O app sempre começa pela tela de login; após autenticar, ela navega para o shell (index.html).
    const distHtmlPath = path.join(__dirname, '../renderer/login/login.html');
    const srcHtmlPath = path.join(__dirname, '../../src/renderer/login/login.html');

    if (fs.existsSync(distHtmlPath)) {
      this.mainWindow.loadFile(distHtmlPath);
    } else {
      this.mainWindow.loadFile(srcHtmlPath);
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }
}

const application = new AppWindowManager();
application.init();
