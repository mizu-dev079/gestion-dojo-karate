import {
  type CallHandler,
  Controller,
  type ExecutionContext,
  Global,
  Header,
  Injectable,
  type MessageEvent,
  Module,
  type NestInterceptor,
  Sse,
} from '@nestjs/common';
import { interval, map, merge, type Observable, Subject, startWith, tap } from 'rxjs';

@Injectable()
export class ActualizacionesPortal {
  private revision = 0;
  private readonly cambios = new Subject<MessageEvent>();
  publicar() {
    this.revision += 1;
    this.cambios.next({ data: { revision: this.revision } });
  }
  observar(): Observable<MessageEvent> {
    return merge(
      this.cambios.pipe(startWith({ data: { revision: this.revision } })),
      interval(25000).pipe(map(() => ({ type: 'latido', data: {} }))),
    );
  }
}

@Injectable()
export class AvisarCambiosInterceptor implements NestInterceptor {
  constructor(private readonly cambios: ActualizacionesPortal) {}
  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const solicitud = contexto.switchToHttp().getRequest<{ method: string; url: string }>();
    if (
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(solicitud.method) ||
      /^\/auth(?:\/|\?|$)/.test(solicitud.url)
    )
      return siguiente.handle();
    return siguiente.handle().pipe(tap(() => this.cambios.publicar()));
  }
}

// Sin @Perfiles: el canal, como las cuentas, solo está disponible para administración.
@Controller('cuentas')
export class ActualizacionesController {
  constructor(private readonly cambios: ActualizacionesPortal) {}
  @Sse('cambios')
  @Header('X-Accel-Buffering', 'no')
  observar() {
    return this.cambios.observar();
  }
}
@Global()
@Module({
  providers: [ActualizacionesPortal, AvisarCambiosInterceptor],
  controllers: [ActualizacionesController],
  exports: [ActualizacionesPortal, AvisarCambiosInterceptor],
})
export class ActualizacionesModule {}
