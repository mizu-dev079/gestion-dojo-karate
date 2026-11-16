import { useEffect, useRef } from 'react';
import { API_URL } from '../lib/api.js';

/** SSE para cambios de la app; comprobación periódica para reconexiones y cambios en Sheets. */
export function useActualizacionesCuentas(cargar, ocupado) {
  const ocupadoActual = useRef(ocupado);
  const solicitar = useRef(() => {});
  useEffect(() => {
    ocupadoActual.current = ocupado;
    if (!ocupado) solicitar.current();
  }, [ocupado]);
  useEffect(() => {
    let terminado = false;
    let leyendo = false;
    let pendiente = false;
    let temporizador;
    async function refrescar() {
      if (terminado) return;
      if (document.hidden || ocupadoActual.current || leyendo) {
        pendiente = true;
        return;
      }
      leyendo = true;
      pendiente = false;
      try {
        await cargar();
      } finally {
        leyendo = false;
        if (!terminado && pendiente) programar();
      }
    }
    function programar() {
      pendiente = true;
      clearTimeout(temporizador);
      temporizador = setTimeout(refrescar, 150);
    }
    solicitar.current = programar;
    const fuente =
      typeof EventSource === 'function'
        ? new EventSource(`${API_URL}/cuentas/cambios`, { withCredentials: true })
        : null;
    if (fuente) fuente.onmessage = programar;
    const visibilidad = () => {
      if (!document.hidden) programar();
    };
    window.addEventListener('focus', programar);
    window.addEventListener('online', programar);
    document.addEventListener('visibilitychange', visibilidad);
    const respaldo = setInterval(programar, 30000);
    refrescar();
    return () => {
      terminado = true;
      solicitar.current = () => {};
      fuente?.close();
      clearTimeout(temporizador);
      clearInterval(respaldo);
      window.removeEventListener('focus', programar);
      window.removeEventListener('online', programar);
      document.removeEventListener('visibilitychange', visibilidad);
    };
  }, [cargar]);
}
