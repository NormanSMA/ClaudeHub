// @ts-check
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hub', {
  /** @param {number} dx @param {number} dy */
  dragBy: (dx, dy) => ipcRenderer.send('hub:drag', dx, dy),
  /** @param {number} width @param {number} height */
  resize: (width, height) => ipcRenderer.send('hub:resize', width, height),
  openDashboard: () => ipcRenderer.send('hub:dashboard'),
  hide: () => ipcRenderer.send('hub:hide'),
  /** @param {string} url */
  openExternal: (url) => ipcRenderer.send('hub:openExternal', url),
})
