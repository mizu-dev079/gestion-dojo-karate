import { useEffect, useState } from 'react';

export function useSesion() {
  const [sesion, setSesion] = useState(null);
  useEffect(() => {
    const actualizar = () => setSesion(window.dojoSesion ?? null);
    actualizar();
    window.addEventListener('dojo:sesion', actualizar);
    return () => window.removeEventListener('dojo:sesion', actualizar);
  }, []);
  return sesion;
}
