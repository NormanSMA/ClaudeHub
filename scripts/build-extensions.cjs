#!/usr/bin/env node
// Arma las extensiones de Chromium y Firefox a partir del codigo compartido de safari/extension/.
// Salida: extensions/dist/chromium/ y extensions/dist/firefox/ (se borran y se recrean).

// @ts-check
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SHARED = path.join(ROOT, 'safari', 'extension')
const DEFAULT_OUT = path.join(ROOT, 'extensions', 'dist')
const BROWSERS = ['chromium', 'firefox']

/**
 * @param {string} [outDir] carpeta de salida; las pruebas pasan una temporal
 * @returns {string[]} carpetas generadas
 */
function buildExtensions(outDir = DEFAULT_OUT) {
  // El manifiesto de Safari usa otra clave de fondo, por eso no se copia.
  const skip = path.join(SHARED, 'manifest.json')
  return BROWSERS.map((browser) => {
    const target = path.join(outDir, browser)
    fs.rmSync(target, { recursive: true, force: true })
    fs.mkdirSync(target, { recursive: true })
    fs.cpSync(SHARED, target, { recursive: true, filter: (src) => src !== skip })
    fs.copyFileSync(path.join(ROOT, 'extensions', browser, 'manifest.json'), path.join(target, 'manifest.json'))
    return target
  })
}

if (require.main === module) {
  for (const dir of buildExtensions()) process.stdout.write('Extension lista en ' + dir + '\n')
}

module.exports = { buildExtensions }
