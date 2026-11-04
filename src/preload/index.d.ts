export interface IElectronAPI {
  ping: () => string;
  getVersions: () => {
    node: string;
    chrome: string;
    electron: string;
  };
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
