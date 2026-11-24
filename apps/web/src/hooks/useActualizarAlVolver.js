import { useEffect, useRef } from 'react';

/** Actualiza datos visibles sin interrumpir una operación o un formulario en curso. */
export function useActualizarAlVolver(cargar, bloqueado = false, habilitado = true) {
  const actual = useRef({ cargar, bloqueado });
  actual.current = { cargar, bloqueado };
  useEffect(() => {
    if (!habilitado) return;
    let leyendo = false;
    const actualizar = async () => {
      if (document.hidden || actual.current.bloqueado || leyendo) return;
      leyendo = true;
      try {
        await actual.current.cargar({ silencioso: true });
      } catch {
        // La recarga manual permite reintentar; se conserva la última consulta disponible.
      } finally {
        leyendo = false;
      }
    };
    const intervalo = setInterval(actualizar, 30_000);
    window.addEventListener('focus', actualizar);
    window.addEventListener('online', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', actualizar);
      window.removeEventListener('online', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, [habilitado]);
}
