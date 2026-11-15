import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_TOKEN_COOKIE } from '../../auth/auth.constants.js';
import { AuthService } from '../../auth/auth.service.js';
import { PERFILES, type Perfil, type SolicitudAutenticada } from '../../auth/sesion.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/** Deniega por defecto: salvo permiso explícito, solo administración. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<SolicitudAutenticada>();
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (typeof token !== 'string') throw new UnauthorizedException('No has iniciado sesión');
    try {
      request.sesion = await this.auth.verificar(token);
    } catch {
      throw new UnauthorizedException(
        'La sesión expiró o la cuenta cambió. Vuelve a iniciar sesión.',
      );
    }
    const perfiles = this.reflector.getAllAndOverride<Perfil[]>(PERFILES, [
      context.getHandler(),
      context.getClass(),
    ]) ?? ['administrador'];
    if (!perfiles.includes(request.sesion.perfil))
      throw new ForbiddenException('Tu perfil no tiene permiso para esta acción.');
    return true;
  }
}
