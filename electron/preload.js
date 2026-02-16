const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cardstock', {
  getDataFolder: () => ipcRenderer.invoke('get-data-folder'),
  pickDataFolder: () => ipcRenderer.invoke('pick-data-folder'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
});
