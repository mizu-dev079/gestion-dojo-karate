import { useId, useState } from 'react';

export default function CampoContrasena({ id: idProp, className = '', disabled, ...props }) {
  const idAutomatico = useId();
  const id = idProp ?? idAutomatico;
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={`${className} pr-24`}
      />
      <button
        type="button"
        disabled={disabled}
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((actual) => !actual)}
        className="absolute inset-y-0 right-1 my-auto h-9 rounded-lg px-2 text-xs font-semibold text-dojo-700 hover:bg-dojo-50 focus-visible:outline-2 focus-visible:outline-dojo-600 disabled:opacity-50"
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  );
}
