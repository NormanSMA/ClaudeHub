const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hub', {
  dragBy: (dx, dy) => ipcRenderer.send('hub:drag', dx, dy),
  resize: (width, height) => ipcRenderer.send('hub:resize', width, height),
  openDashboard: () => ipcRenderer.send('hub:dashboard'),
  hide: () => ipcRenderer.send('hub:hide'),
})
