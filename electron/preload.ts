import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('cardstock', {
  getDataFolder: () => ipcRenderer.invoke('get-data-folder'),
  getDefaultDataFolder: () => ipcRenderer.invoke('get-default-data-folder'),
  pickDataFolder: () => ipcRenderer.invoke('pick-data-folder'),
  useDataFolder: (folderPath: string) => ipcRenderer.invoke('use-data-folder', folderPath),
  welcomeDone: (folderPath: string) => ipcRenderer.invoke('welcome-done', folderPath),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
});
