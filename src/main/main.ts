import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

class AppWindowManager {
  private mainWindow: BrowserWindow | null = null;

  public init(): void {
    app.whenReady().then(() => {
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
        preload: path.join(__dirname, '../preload/preload.js')
      }
    });

    // Caminho da página inicial compilada ou de desenvolvimento
    const distHtmlPath = path.join(__dirname, '../renderer/index.html');
    const srcHtmlPath = path.join(__dirname, '../../src/renderer/index.html');

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
