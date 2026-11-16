import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  ActualizacionesModule,
  AvisarCambiosInterceptor,
} from './actualizaciones/actualizaciones.module.js';
import { AlumnosModule } from './alumnos/alumnos.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ClasesModule } from './clases/clases.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ProfesoresModule } from './profesores/profesores.module.js';

@Module({
  imports: [ActualizacionesModule, AuthModule, ClasesModule, ProfesoresModule, AlumnosModule],
  controllers: [AppController],
  providers: [
    { provide: APP_INTERCEPTOR, useExisting: AvisarCambiosInterceptor },
    AppService,
    // Todas las rutas exigen sesión salvo las marcadas con @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
