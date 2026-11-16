import { useState } from 'react';
import { agruparClases, idClase, nombreTurno } from '../lib/turnos.js';
export default function SelectorClaseTurno({
  turnos,
  valor,
  cambiar,
  claseInicial = '',
  etiquetaClase = 'Clase del alumno',
  etiquetaTurno = 'Turno del alumno',
  className,
  disabled = false,
}) {
  const [grupo, setGrupo] = useState(String(claseInicial));
  const seleccionado = turnos.find((t) => String(t.id) === String(valor));
  const grupoActual = seleccionado ? String(idClase(seleccionado)) : grupo;
  const clases = agruparClases(turnos),
    opciones = clases.find((c) => String(c.id) === grupoActual)?.turnos ?? [];
  const conTurnos = turnos.some((t) => t.turnoId !== undefined);
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold">
        {etiquetaClase}
        <select
          required
          disabled={disabled}
          value={grupoActual}
          className={className}
          onChange={(e) => {
            setGrupo(e.target.value);
            const candidatos = clases.find((c) => String(c.id) === e.target.value)?.turnos ?? [];
            const unico = candidatos.length === 1 ? candidatos[0] : null;
            cambiar(
              unico &&
                unico.estado !== 'Inactiva' &&
                unico.configurado !== false &&
                unico.cuposDisponibles !== 0
                ? String(unico.id)
                : '',
            );
          }}
        >
          <option value="">Selecciona una clase</option>
          {clases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {conTurnos && (
        <label className="block text-sm font-semibold">
          {etiquetaTurno}
          <select
            required
            disabled={disabled || !grupoActual}
            value={valor ?? ''}
            className={className}
            onChange={(e) => cambiar(e.target.value)}
          >
            <option value="">Selecciona días y edades</option>
            {opciones.map((t) => (
              <option
                key={t.id}
                value={t.id}
                disabled={
                  t.estado === 'Inactiva' || t.configurado === false || t.cuposDisponibles === 0
                }
              >
                {nombreTurno(t)} · {t.horaInicio}–{t.horaFin}
                {t.configurado === false
                  ? ' · Por configurar'
                  : t.cuposDisponibles === 0
                    ? ' · Sin cupos'
                    : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
