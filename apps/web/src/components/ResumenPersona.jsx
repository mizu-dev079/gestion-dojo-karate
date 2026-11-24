import IconoPerfil from './perfiles/IconoPerfil.jsx';

/** Fila compartida: identidad, estado y saldo; la gestión se abre al seleccionar. */
export default function ResumenPersona({
  nombre,
  detalle,
  estado,
  saldo,
  onClick,
  expandido,
  controles,
}) {
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('');
  return (
    <button
      type="button"
      className="persona-fila"
      onClick={onClick}
      aria-expanded={expandido}
      aria-controls={controles}
    >
      <span className="persona-avatar" aria-hidden="true">
        {iniciales}
      </span>
      <span className="persona-identidad">
        <strong>{nombre}</strong>
        {detalle && <span className="persona-detalle">{detalle}</span>}
        {estado && <span className="persona-estado">{estado}</span>}
      </span>
      {saldo !== undefined && (
        <span className="persona-saldo">
          <strong>{saldo}</strong>
          <span>clases</span>
        </span>
      )}
      <span className="persona-flecha" aria-hidden="true">
        <IconoPerfil nombre="flecha" size={18} />
      </span>
    </button>
  );
}
