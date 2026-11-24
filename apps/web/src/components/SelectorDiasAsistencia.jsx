import { useEffect, useRef } from 'react';
import { desplazar, fechaVisible } from '../lib/seguimiento.js';

const nombreDia = (fecha, formato) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    ...formato,
  }).format(new Date(`${fecha}T12:00:00Z`));

export default function SelectorDiasAsistencia({ fecha, maximo, cambiar, disabled = false }) {
  const tira = useRef(null);
  const enfocar = useRef(false);
  const seleccion = fecha > maximo ? maximo : fecha;
  const fin = seleccion < desplazar(maximo, -3) ? desplazar(seleccion, 3) : maximo;
  const dias = Array.from({ length: 7 }, (_, i) => desplazar(fin, i - 6));

  useEffect(() => {
    if (disabled) return;
    const contenedor = tira.current;
    const centrar = () => {
      const activo = contenedor?.querySelector(`[data-fecha="${seleccion}"]`);
      if (!activo) return;
      contenedor.scrollTo({
        left: activo.offsetLeft - (contenedor.clientWidth - activo.offsetWidth) / 2,
        behavior: 'auto',
      });
      if (enfocar.current) {
        activo.focus({ preventScroll: true });
        enfocar.current = false;
      }
    };
    centrar();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(centrar);
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [seleccion, disabled]);

  function elegir(dia, teclado = false) {
    if (disabled || dia > maximo) return;
    enfocar.current = teclado;
    cambiar(dia);
  }

  function teclado(event) {
    const destino =
      event.key === 'ArrowLeft'
        ? desplazar(seleccion, -1)
        : event.key === 'ArrowRight'
          ? desplazar(seleccion, 1)
          : event.key === 'Home'
            ? dias[0]
            : event.key === 'End'
              ? maximo
              : null;
    if (!destino) return;
    event.preventDefault();
    elegir(destino, true);
  }

  return (
    <fieldset disabled={disabled} className="selector-dias" aria-label="Elegir día de asistencia">
      <div className="selector-dias__cabecera">
        <button
          type="button"
          aria-label="Día anterior"
          onClick={() => elegir(desplazar(seleccion, -1))}
        >
          ‹
        </button>
        <p aria-live="polite" aria-atomic="true" className="selector-dias__fecha">
          {seleccion === maximo ? 'Hoy' : nombreDia(seleccion, { weekday: 'long' })}
          <span className="selector-dias__fecha-completa">{fechaVisible(seleccion)}</span>
        </p>
        <button
          type="button"
          aria-label="Día siguiente"
          disabled={disabled || seleccion >= maximo}
          onClick={() => elegir(desplazar(seleccion, 1))}
        >
          ›
        </button>
      </div>
      <div ref={tira} className="selector-dias__tira">
        {dias.map((dia) => (
          <button
            key={dia}
            data-fecha={dia}
            type="button"
            aria-label={nombreDia(dia, { dateStyle: 'full' })}
            aria-pressed={seleccion === dia}
            aria-current={dia === maximo ? 'date' : undefined}
            tabIndex={seleccion === dia ? 0 : -1}
            onKeyDown={teclado}
            onClick={() => elegir(dia)}
            className="selector-dias__dia"
          >
            <span className="selector-dias__etiqueta">
              {nombreDia(dia, { weekday: 'short' }).replace('.', '')}
            </span>
            <strong>{Number(dia.slice(8))}</strong>
            <span className="selector-dias__etiqueta">
              {dia === maximo ? 'Hoy' : nombreDia(dia, { month: 'short' }).replace('.', '')}
            </span>
          </button>
        ))}
      </div>
      {seleccion !== maximo && (
        <button type="button" className="selector-dias__hoy" onClick={() => elegir(maximo)}>
          Volver a hoy
        </button>
      )}
    </fieldset>
  );
}
