import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// las pruebas nunca leen la carpeta de datos real del usuario (config.json, limites, cache)
if (!process.env.CLAUDEHUB_DATA) process.env.CLAUDEHUB_DATA = mkdtempSync(join(tmpdir(), 'claudehub-test-'))
if (!process.env.ANTIGRAVITY_DIR) process.env.ANTIGRAVITY_DIR = join(process.env.CLAUDEHUB_DATA, 'antigravity-empty')
