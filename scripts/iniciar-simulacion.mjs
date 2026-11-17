import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const require = createRequire(resolve(raiz, 'apps/web/package.json'));
  const archivo = require.resolve('astro/package.json');
  const paquete = JSON.parse(readFileSync(archivo, 'utf8'));
  const cli = resolve(
    dirname(archivo),
    typeof paquete.bin === 'string' ? paquete.bin : paquete.bin.astro,
  );
  const env = { ...process.env, NODE_ENV: 'development' };
  for (const clave of Object.keys(env))
    if (/^(GOOGLE_|JWT_|ADMIN_|PUBLIC_API_URL$|WEB_URL$|COOKIE_DOMAIN$|NODE_OPTIONS$)/.test(clave))
      delete env[clave];
  const estado = spawnSync(process.execPath, [cli, 'dev', 'status'], {
    cwd: resolve(raiz, 'apps/web'),
    env,
    encoding: 'utf8',
  });
  if (estado.error) throw estado.error;
  const puertoActivo = estado.stdout?.match(/localhost:(\d+)/)?.[1];
  if (puertoActivo && puertoActivo !== '4322')
    throw new Error(
      'Ya existe otro frontend en esta carpeta. Usa la copia de colaboración; no se ha detenido ni modificado el servidor existente.',
    );
  const parar = process.argv.includes('--detener');
  const argumentos = parar
    ? ['dev', 'stop']
    : [
        'dev',
        '--background',
        '--config',
        './astro.simulacion.config.mjs',
        '--host',
        '0.0.0.0',
        '--port',
        '4322',
      ];
  const resultado = spawnSync(process.execPath, [cli, ...argumentos], {
    cwd: resolve(raiz, 'apps/web'),
    env,
    stdio: 'inherit',
  });
  if (resultado.error) throw resultado.error;
  process.exitCode = resultado.status ?? 1;
  if (!parar && !process.exitCode)
    console.log(
      '\nModo simulado: http://localhost:4322\nProfesor: profesor.prueba / profesor.prueba\nAlumno: alumno.prueba / alumno.prueba\nDetener y reiniciar los datos: pnpm stop:simulado y pnpm dev:simulado\nLive Share: compartir únicamente el puerto 4322.',
    );
} catch (error) {
  console.error(`No se pudo iniciar la simulación: ${error.message}`);
  if (error.code === 'MODULE_NOT_FOUND')
    console.error('Ejecuta pnpm install --frozen-lockfile en esta carpeta.');
  process.exitCode = 1;
}
