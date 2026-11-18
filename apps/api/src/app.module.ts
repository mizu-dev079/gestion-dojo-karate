import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  ActualizacionesModule,
  AvisarCambiosInterceptor,
} from './actualizaciones/actualizaciones.module.js';
import { AlumnosModule } from './alumnos/alumnos.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClasesModule } from './clases/clases.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { conLecturaCompartida } from './portal/libro.js';
import { ProfesoresModule } from './profesores/profesores.module.js';

@Module({
  imports: [ActualizacionesModule, AuthModule, ClasesModule, ProfesoresModule, AlumnosModule],
  providers: [
    { provide: APP_INTERCEPTOR, useExisting: AvisarCambiosInterceptor },
    // Todas las rutas exigen sesión salvo las marcadas con @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_req: unknown, _res: unknown, next: () => void) => conLecturaCompartida(next))
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
