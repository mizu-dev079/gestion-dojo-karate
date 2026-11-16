// Enlace público del formulario de una clase. Es lo que codifica el QR.
export function enlaceFormulario(clase) {
  if (typeof window === 'undefined' || !clase?.id) {
    return '';
  }

  return `${window.location.origin}/formulario?clase=${encodeURIComponent(clase.claseBaseId ?? clase.id)}${clase.turnoId !== undefined ? `&turno=${encodeURIComponent(clase.id)}` : ''}`;
}
