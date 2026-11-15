import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { env } from '../config/env.js';
import { ACCESS_TOKEN_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { CuentasService } from './cuentas.service.js';
import { LoginDto } from './dto/login.dto.js';
import { Perfiles, type SolicitudAutenticada } from './sesion.js';

function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000,
    path: '/',
  };
}

@Perfiles('administrador', 'profesor', 'alumno')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cuentas: CuentasService,
  ) {}

  /** POST /auth/login */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() datos: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.authService.login(
      datos.usuario,
      datos.password,
      request.ip ?? 'desconocida',
    );

    response.cookie(ACCESS_TOKEN_COOKIE, token, opcionesCookie());

    return this.authService.verificar(token);
  }

  /** POST /auth/logout */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { ...opcionesCookie(), maxAge: undefined });
  }

  @Post('password')
  async cambiarPassword(
    @Req() request: SolicitudAutenticada,
    @Body() datos: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.cuentas.cambiarPassword(request.sesion, datos);
    response.clearCookie(ACCESS_TOKEN_COOKIE, { ...opcionesCookie(), maxAge: undefined });
    return { mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }

  /** GET /auth/me: responde 200 si hay sesión (el guard responde 401 si no). */
  @Get('me')
  me(@Req() request: SolicitudAutenticada) {
    return request.sesion;
  }
}
