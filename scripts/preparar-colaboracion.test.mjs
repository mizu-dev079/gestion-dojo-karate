import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepararColaboracion } from './preparar-colaboracion.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('exporta solo el frontend y contratos; excluye secretos, API, cachés y enlaces simbólicos', () => {
  const temporal = mkdtempSync(join(tmpdir(), 'dojo-exportacion-'));
  const fuente = join(temporal, 'fuente'),
    destino = join(temporal, 'compartida');
  try {
    // Obtener una fuente válida sin copiar secretos del repositorio real.
    prepararColaboracion({ raiz, destino: fuente });
    // La copia también debe poder exportarse sin documentación externa.
    assert.equal(existsSync(join(fuente, 'docs')), false);
    for (const f of [
      'apps/web/.env',
      'apps/web/.env.local',
      'apps/web/public/google-service-account.json',
      'apps/web/public/credencial.json',
      'apps/web/src/credentials/llave.json',
      'apps/api/.env',
      'apps/web/node_modules/privado.js',
    ]) {
      const p = join(fuente, f);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, 'secreto-ficticio');
    }
    try {
      symlinkSync(join(fuente, 'apps/web/.env'), join(fuente, 'apps/web/public/enlace.js'));
    } catch (error) {
      // Windows puede requerir modo de desarrollador para crear enlaces simbólicos.
      if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error;
    }
    prepararColaboracion({ raiz: fuente, destino });
    assert.equal(existsSync(join(destino, 'apps/api')), false);
    assert.equal(existsSync(join(destino, '.git')), false);
    assert.match(
      readFileSync(join(destino, 'apps/web/astro.config.mjs'), 'utf8'),
      /astro.simulacion/,
    );
    assert.match(
      readFileSync(join(destino, 'apps/web/astro.simulacion.config.mjs'), 'utf8'),
      /astro.base.config/,
    );
    assert.equal(existsSync(join(destino, 'apps/web/.env')), false);
    assert.equal(existsSync(join(destino, 'apps/web/public/enlace.js')), false);
    assert.equal(existsSync(join(destino, 'apps/web/public/credencial.json')), false);
    assert.equal(existsSync(join(destino, 'apps/web/node_modules')), false);
    assert.equal(existsSync(join(destino, 'apps/web/src/credentials')), false);
    assert.equal(
      existsSync(join(destino, 'apps/web/src/components/perfiles/profesor/PanelProfesor.jsx')),
      true,
    );
    assert.equal(
      JSON.parse(readFileSync(join(destino, 'package.json'))).scripts.dev,
      'node scripts/iniciar-simulacion.mjs',
    );
    assert.ok(readdirSync(destino).includes('LEEME-COLABORACION.md'));
    assert.match(
      readFileSync(join(destino, 'LEEME-COLABORACION.md'), 'utf8'),
      /pnpm install --frozen-lockfile/,
    );
    assert.match(
      readFileSync(join(destino, 'LEEME-COLABORACION.md'), 'utf8'),
      /sin conexión con Sheets/,
    );
    assert.throws(() => prepararColaboracion({ raiz: fuente, destino }), /ya existe/);
    assert.throws(
      () => prepararColaboracion({ raiz: fuente, destino: join(fuente, 'interior') }),
      /independiente/,
    );
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
});
