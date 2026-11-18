// Carrega o .env antes de qualquer módulo ler configuração (sessão, lembretes, SMTP, banco).
import 'dotenv/config';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registrarHandlers } from './ipc';
import { LembretesContainer } from './ipc/LembretesContainer';

class AppWindowManager {
  private mainWindow: BrowserWindow | null = null;
  private readonly lembretes = new LembretesContainer();

  public init(): void {
    app.whenReady().then(() => {
      registrarHandlers({ lembretes: this.lembretes });
      this.lembretes.agendador.iniciar();
      this.createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('before-quit', () => this.lembretes.agendador.parar());

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
