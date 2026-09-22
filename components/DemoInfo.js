/**
 * Ficha técnica que va debajo de cada demo: qué herramienta hace qué.
 */
export default function DemoInfo({ number, title, summary, tools, file }) {
  return (
    <section className="info">
      <div className="info-inner">
        <p className="eyebrow">Demo {number} · Cómo está hecho</p>
        <h3>{title}</h3>
        <p className="info-summary">{summary}</p>
        <ul className="tool-list">
          {tools.map((t) => (
            <li key={t.name}>
              <span className="tool-name">{t.name}</span>
              <span className="tool-role">{t.role}</span>
            </li>
          ))}
        </ul>
        <p className="info-file">
          Código: <code>{file}</code>
        </p>
      </div>
    </section>
  );
}
