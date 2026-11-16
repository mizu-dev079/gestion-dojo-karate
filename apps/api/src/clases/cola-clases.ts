const operaciones = new Map<number, Promise<void>>();

/** Una sola cola por clase para admisiones públicas y altas manuales de esta instancia. */
export function enClaseCompartida<T>(claseId: number, operacion: () => Promise<T>): Promise<T> {
  const anterior = operaciones.get(claseId) ?? Promise.resolve();
  const resultado = anterior.then(operacion);
  const turno = resultado.then(
    () => undefined,
    () => undefined,
  );
  operaciones.set(claseId, turno);
  void turno.then(() => {
    if (operaciones.get(claseId) === turno) operaciones.delete(claseId);
  });
  return resultado;
}
