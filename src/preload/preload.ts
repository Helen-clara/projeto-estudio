import { contextBridge } from 'electron';

const api = {
  ping: (): string => 'pong',
  getVersions: () => ({
    node: process.versions.node || '',
    chrome: process.versions.chrome || '',
    electron: process.versions.electron || ''
  })
};

contextBridge.exposeInMainWorld('api', api);
