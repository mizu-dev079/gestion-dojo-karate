import { imagenClase } from '../lib/clases.js';
import IconoPerfil from './perfiles/IconoPerfil.jsx';

export default function ImagenClase({ nombre, compacta = false }) {
  const src = imagenClase(nombre);
  return (
    <div className={compacta ? 'clase-imagen clase-imagen--compacta' : 'clase-imagen'}>
      {src ? (
        <img
          src={src}
          alt={`Clase ${nombre}`}
          width="640"
          height="480"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <IconoPerfil nombre="clase" size={32} />
      )}
    </div>
  );
}
