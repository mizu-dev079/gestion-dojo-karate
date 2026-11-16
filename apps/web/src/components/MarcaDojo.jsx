export const NOMBRE_DOJO = 'Shinken Dojo - Hiroshi';

const LOGO_DOJO = '/logo-dojo.png';

export default function MarcaDojo({ compacta = false }) {
  return (
    <span className={`dojo-brand${compacta ? ' dojo-brand--compact' : ''}`}>
      <img src={LOGO_DOJO} alt="" width="64" height="64" className="dojo-brand__logo" />
      <span className="dojo-brand__name">{NOMBRE_DOJO}</span>
    </span>
  );
}
