import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { env } from '../config/env.js';
import { ProfesoresRepository } from '../profesores/repositories/profesores.repository.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CuentasController } from './cuentas.controller.js';
import { CuentasRepository } from './cuentas.repository.js';
import { CuentasService } from './cuentas.service.js';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN_SECONDS },
    }),
  ],
  controllers: [AuthController, CuentasController],
  providers: [
    AuthService,
    CuentasService,
    CuentasRepository,
    ProfesoresRepository,
    PostulacionesRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
