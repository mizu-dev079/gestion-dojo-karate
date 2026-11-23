const trazos = {
  postulaciones: ['M8 4H5v17h14V4h-3', 'M9 3h6v4H9z', 'm8 13 2 2 5-5', 'M8 18h8'],
  cuenta: ['M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M4 21v-2a8 8 0 0 1 16 0v2'],
  seguridad: ['M5 10h14v11H5z', 'M8 10V7a4 4 0 0 1 8 0v3', 'M12 14v3'],
  ayuda: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    'M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2.5',
    'M12 17h.01',
  ],
  calendario: ['M5 5h14v15H5z', 'M8 3v4M16 3v4M5 10h14', 'm9 15 2 2 4-4'],
  alumnos: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    'M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
  ],
  clase: ['m3 9 9-5 9 5-9 5-9-5Z', 'M6 11v6l6 3 6-3v-6'],
  pausa: ['M8 5v14M16 5v14'],
  historial: ['M3 11a9 9 0 1 1 2.5 7', 'M3 4v7h7', 'M12 7v5l3 2'],
  flecha: ['M5 12h14', 'm13 6 6 6-6 6'],
  presente: ['m5 12 4 4L19 6'],
};
export default function IconoPerfil({ nombre, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(trazos[nombre] ?? trazos.clase).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
