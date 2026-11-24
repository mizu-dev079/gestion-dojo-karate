import ImagenClase from './ImagenClase.jsx';

export default function PortadaClase({ nombre, turnos, nivel = 2 }) {
  const Titulo = nivel === 3 ? 'h3' : 'h2';
  return (
    <div className="curso-portada">
      <div className="curso-portada__texto">
        {turnos != null && (
          <span className="curso-etiqueta">
            {turnos} {turnos === 1 ? 'turno' : 'turnos'}
          </span>
        )}
        <Titulo className="curso-portada__titulo">{nombre}</Titulo>
      </div>
      <ImagenClase nombre={nombre} />
    </div>
  );
}
