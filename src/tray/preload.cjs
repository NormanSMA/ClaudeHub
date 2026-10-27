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
  /** @param {'corner' | 'island'} mode */
  setMode: (mode) => ipcRenderer.send('hub:mode', mode),
  /**
   * Posicion del cursor relativa a la ventana, cada 50 ms (solo en modo isla).
   * @param {(x: number, y: number) => void} cb
   * @returns {() => void}
   */
  onCursor: (cb) => {
    /** @param {unknown} e @param {number} x @param {number} y */
    const handler = (e, x, y) => cb(x, y)
    ipcRenderer.on('hub:cursor', handler)
    return () => ipcRenderer.removeListener('hub:cursor', handler)
  },
})
