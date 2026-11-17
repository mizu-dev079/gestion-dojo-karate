import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizProyecto = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensiones = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.astro',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.md',
]);
const excluido = (nombre) =>
  /^(?:\.env(?:\..*)?|credentials|node_modules|dist|\.astro|\.git)$/i.test(nombre) ||
  /service.account|\.pem$|\.key$/i.test(nombre);
const dentro = (padre, hijo) => {
  const r = relative(padre, hijo);
  return !r || (!r.startsWith(`..${sep}`) && r !== '..' && !isAbsolute(r));
};

/** Exportación por lista permitida: no copia apps/api, variables de entorno ni carpetas ocultas. */
export function prepararColaboracion({
  raiz = raizProyecto,
  destino = `${raizProyecto}-colaboracion`,
} = {}) {
  raiz = realpathSync(raiz);
  destino = resolve(realpathSync(dirname(resolve(destino))), destino.split(/[\\/]/).at(-1));
  if (dentro(raiz, destino) || dentro(destino, raiz))
    throw new Error('El destino debe ser una carpeta independiente, fuera del repositorio.');
  if (existsSync(destino))
    throw new Error(
      'La carpeta de colaboración ya existe. Se conserva intacta; utiliza otro destino.',
    );
  const archivos = new Set([
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
    'biome.json',
    '.nvmrc',
    '.editorconfig',
    '.gitattributes',
    '.vsls.json',
    '.vscode/extensions.json',
    '.vscode/settings.json',
    'apps/web/package.json',
    'apps/web/tsconfig.json',
    'apps/web/astro.config.mjs',
    'apps/web/astro.simulacion.config.mjs',
    'apps/web/AGENTS.md',
    'apps/web/CLAUDE.md',
    'packages/shared/package.json',
    'packages/shared/tsconfig.json',
    'scripts/iniciar-simulacion.mjs',
  ]);
  function recorrer(base) {
    const absoluto = join(raiz, base);
    if (!existsSync(absoluto) || lstatSync(absoluto).isSymbolicLink()) return;
    for (const nombre of readdirSync(absoluto)) {
      if (excluido(nombre) || nombre.startsWith('.')) continue;
      const ruta = join(base, nombre),
        st = lstatSync(join(raiz, ruta));
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) recorrer(ruta);
      else if (st.isFile() && extensiones.has(extname(nombre))) archivos.add(ruta);
    }
  }
  for (const carpeta of [
    'apps/web/src',
    'apps/web/public',
    'apps/web/simulacion',
    'packages/shared/src',
  ])
    recorrer(carpeta);
  for (const archivo of archivos)
    if (!existsSync(join(raiz, archivo)) || lstatSync(join(raiz, archivo)).isSymbolicLink())
      throw new Error(`Falta un archivo necesario: ${archivo}`);
  mkdirSync(destino);
  try {
    for (const archivo of archivos) {
      const salida = join(destino, archivo);
      mkdirSync(dirname(salida), { recursive: true });
      copyFileSync(join(raiz, archivo), salida);
    }
    // La copia usa siempre la API ficticia, incluso con comandos directos de Astro.
    const baseConfig = join(raiz, 'apps/web/astro.base.config.mjs');
    copyFileSync(
      existsSync(baseConfig) ? baseConfig : join(raiz, 'apps/web/astro.config.mjs'),
      join(destino, 'apps/web/astro.base.config.mjs'),
    );
    const configSimulada = join(destino, 'apps/web/astro.simulacion.config.mjs');
    writeFileSync(
      configSimulada,
      readFileSync(configSimulada, 'utf8').replace(
        "from './astro.config.mjs'",
        "from './astro.base.config.mjs'",
      ),
    );
    writeFileSync(
      join(destino, 'apps/web/astro.config.mjs'),
      "export { default } from './astro.simulacion.config.mjs';\n",
    );
    const paquete = JSON.parse(readFileSync(join(destino, 'package.json'), 'utf8'));
    paquete.scripts = {
      dev: 'node scripts/iniciar-simulacion.mjs',
      'dev:simulado': 'node scripts/iniciar-simulacion.mjs',
      'stop:simulado': 'node scripts/iniciar-simulacion.mjs --detener',
      'test:simulado': 'node --test apps/web/simulacion/*.test.mjs',
      build: 'pnpm --filter @dojo/shared build && pnpm --filter web build',
      check: 'biome check --write .',
      postinstall: 'pnpm --filter @dojo/shared build',
    };
    writeFileSync(join(destino, 'package.json'), `${JSON.stringify(paquete, null, 2)}\n`);
    writeFileSync(
      join(destino, '.gitignore'),
      'node_modules/\ndist/\n.astro/\n.turbo/\n*.tsbuildinfo\n.env\n.env.*\ncredentials/\n',
    );
    copyFileSync(
      join(raiz, 'docs/09-colaboracion-simulada.md'),
      join(destino, 'LEEME-COLABORACION.md'),
    );
    return { destino, archivos: archivos.size };
  } catch (error) {
    rmSync(destino, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const pos = process.argv.indexOf('--destino');
    if (pos !== -1 && !process.argv[pos + 1])
      throw new Error('Indica una carpeta después de --destino.');
    const r = prepararColaboracion({
      destino: pos === -1 ? undefined : resolve(process.argv[pos + 1]),
    });
    console.log(
      `Copia preparada: ${r.destino}\nSin .env, credenciales, backend real ni historial Git.\nAbre esa carpeta en VS Code y ejecuta:\n  pnpm install --frozen-lockfile\n  pnpm dev\nDespués inicia Live Share y comparte el puerto 4322.\nNo se ha modificado el repositorio original.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
