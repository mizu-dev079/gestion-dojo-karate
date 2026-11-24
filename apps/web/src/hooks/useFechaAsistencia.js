import { useCallback, useEffect, useRef, useState } from 'react';
import { fechaValida, hoyLima } from '../lib/fechas.js';
import { actualizarNavegacion } from '../lib/navegacion.js';

/** Selección compartida, con fecha persistida y límite en el día actual de Lima. */
export function useFechaAsistencia() {
  const [limite, setLimite] = useState(hoyLima);
  const [fecha, setFecha] = useState(hoyLima);
  const [lista, setLista] = useState(false);
  const anterior = useRef(limite);
  const leer = useCallback(() => {
    const valor = new URLSearchParams(window.location.search).get('fecha');
    const hoy = hoyLima();
    setFecha(fechaValida(valor) && valor <= hoy ? valor : hoy);
  }, []);
  useEffect(() => {
    leer();
    setLista(true);
    window.addEventListener('popstate', leer);
    const actualizar = () => {
      const hoy = hoyLima();
      if (hoy === anterior.current) return;
      const previa = anterior.current;
      anterior.current = hoy;
      setLimite(hoy);
      setFecha((valor) => (valor === previa || valor > hoy ? hoy : valor));
    };
    const intervalo = setInterval(actualizar, 30_000);
    window.addEventListener('focus', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('popstate', leer);
      window.removeEventListener('focus', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, [leer]);
  useEffect(() => {
    if (!lista) return;
    const url = new URL(window.location.href);
    url.searchParams.set('fecha', fecha);
    actualizarNavegacion(url);
  }, [fecha, lista]);
  const elegirFecha = useCallback((valor) => {
    const hoy = hoyLima();
    setFecha((actual) => {
      const elegida = typeof valor === 'function' ? valor(actual) : valor;
      return fechaValida(elegida) && elegida <= hoy ? elegida : hoy;
    });
  }, []);
  return { fecha, setFecha: elegirFecha, limite };
}
