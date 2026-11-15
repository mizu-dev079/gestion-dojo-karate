import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '../config/env.js';
import { CuentasService } from './cuentas.service.js';
import type { Sesion } from './sesion.js';

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

/** Compara dos textos en tiempo constante (no revela cuántos caracteres coinciden). */
function iguales(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

@Injectable()
export class AuthService {
  // Intentos fallidos por IP. Vive en memoria: se reinicia si se reinicia la API.
  private readonly intentos = new Map<string, { cantidad: number; desde: number }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly cuentas: CuentasService,
  ) {}

  async login(usuario: string, password: string, ip: string): Promise<string> {
    this.verificarBloqueo(ip);

    const usuarioValido = iguales(usuario, env.ADMIN_USUARIO);
    const passwordValido = iguales(password, env.ADMIN_PASSWORD);

    if (usuarioValido && passwordValido) {
      this.intentos.delete(ip);
      return this.jwtService.signAsync({ sub: 'admin', usuario: env.ADMIN_USUARIO });
    }
    const cuenta = usuarioValido ? null : await this.cuentas.autenticar(usuario.trim(), password);
    if (!cuenta) {
      this.registrarFallo(ip);
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    await this.cuentas.sesion(cuenta.id, cuenta.revision);
    this.intentos.delete(ip);
    return this.jwtService.signAsync({ sub: cuenta.id, revision: cuenta.revision });
  }

  async verificar(token: string): Promise<Sesion> {
    const datos = await this.jwtService.verifyAsync(token);
    // Mantiene las sesiones del administrador ya configurado, sin confiar en un rol enviado por el cliente.
    if (datos.sub === 'admin' && datos.usuario === env.ADMIN_USUARIO)
      return { id: 'admin', usuario: env.ADMIN_USUARIO, perfil: 'administrador', alumnoIds: [] };
    if (typeof datos.sub !== 'string' || !Number.isInteger(datos.revision))
      throw new UnauthorizedException('Sesión inválida.');
    return this.cuentas.sesion(datos.sub, datos.revision);
  }

  private verificarBloqueo(ip: string) {
    const registro = this.intentos.get(ip);

    if (registro && Date.now() - registro.desde > VENTANA_MS) {
      this.intentos.delete(ip);
      return;
    }

    if (registro && registro.cantidad >= MAX_INTENTOS) {
      throw new HttpException(
        'Demasiados intentos fallidos. Espera unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registrarFallo(ip: string) {
    const registro = this.intentos.get(ip);

    if (registro) {
      registro.cantidad += 1;
    } else {
      this.intentos.set(ip, { cantidad: 1, desde: Date.now() });
    }
  }
}
