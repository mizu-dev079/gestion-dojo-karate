import type { ExecutionContext, MessageEvent } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ActualizacionesPortal, AvisarCambiosInterceptor } from './actualizaciones.module.js';

const contexto = (method: string, url: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ method, url }) }),
  }) as unknown as ExecutionContext;
describe('Notificaciones de cambios sin datos personales', () => {
  it('inicia la conexión con la revisión actual y notifica cambios posteriores', () => {
    const cambios = new ActualizacionesPortal();
    const recibidos: MessageEvent[] = [];
    const suscripcion = cambios.observar().subscribe((e) => recibidos.push(e));
    try {
      cambios.publicar();
      expect(recibidos.map((e) => e.data)).toEqual([{ revision: 0 }, { revision: 1 }]);
    } finally {
      suscripcion.unsubscribe();
    }
  });
  it('publica después de una escritura exitosa, sin incluir la respuesta', async () => {
    const cambios = new ActualizacionesPortal(),
      interceptor = new AvisarCambiosInterceptor(cambios),
      recibidos: MessageEvent[] = [];
    const suscripcion = cambios.observar().subscribe((e) => recibidos.push(e));
    try {
      await lastValueFrom(
        interceptor.intercept(contexto('POST', '/cuentas'), {
          handle: () => of({ nombre: 'Privado', correo: 'privado@example.com' }),
        }),
      );
      expect(recibidos.at(-1)?.data).toEqual({ revision: 1 });
      expect(JSON.stringify(recibidos)).not.toContain('Privado');
    } finally {
      suscripcion.unsubscribe();
    }
  });
  it('no publica al fallar, consultar o iniciar sesión', async () => {
    const cambios = new ActualizacionesPortal(),
      interceptor = new AvisarCambiosInterceptor(cambios),
      recibidos: MessageEvent[] = [];
    const suscripcion = cambios.observar().subscribe((e) => recibidos.push(e));
    try {
      await expect(
        lastValueFrom(
          interceptor.intercept(contexto('POST', '/cuentas'), {
            handle: () => throwError(() => new Error('Falló')),
          }),
        ),
      ).rejects.toThrow('Falló');
      for (const [method, url] of [
        ['GET', '/cuentas'],
        ['POST', '/auth/login'],
        ['POST', '/auth/logout'],
      ])
        await lastValueFrom(interceptor.intercept(contexto(method, url), { handle: () => of({}) }));
      expect(recibidos.map((e) => e.data)).toEqual([{ revision: 0 }]);
    } finally {
      suscripcion.unsubscribe();
    }
  });
});
