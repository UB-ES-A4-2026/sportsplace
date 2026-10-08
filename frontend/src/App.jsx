import { useEffect, useState } from 'react';

export default function App() {
  const [attempt, setAttempt] = useState(0);
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    async function checkApi() {
      setApiStatus('checking');

      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) throw new Error('API unavailable');

        const health = await response.json();
        if (health.status !== 'ok' || health.service !== 'sportsplace-api') {
          throw new Error('Unexpected health response');
        }

        if (active) setApiStatus('ready');
      } catch {
        if (active) setApiStatus('error');
      } finally {
        window.clearTimeout(timeout);
      }
    }

    checkApi();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const apiMessage = {
    checking: 'Comprobando conexión…',
    ready: 'Servidor disponible',
    error: 'No se ha podido conectar con el servidor',
  }[apiStatus];

  return (
    <main className="page">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Sportsplace</span>
      </header>

      <section className="intro" aria-labelledby="title">
        <p className="eyebrow">Sprint 0 · Entorno de desarrollo</p>
        <h1 id="title">Más oportunidades para el material deportivo.</h1>
        <p className="intro-text">
          Una plataforma para que clubes y centros deportivos puedan dar una
          segunda vida a su material. Esta página permite comprobar el arranque
          de la web y su conexión con el servidor.
        </p>
      </section>

      <section className="environment" aria-labelledby="environment-title">
        <h2 id="environment-title">Estado del entorno</h2>
        <div className="status-grid">
          <article className="status-card">
            <p className="card-label">Web · React</p>
            <p className="status ready"><span className="dot" aria-hidden="true" />En funcionamiento</p>
            <p className="card-text">El frontend ha arrancado correctamente.</p>
          </article>

          <article className="status-card">
            <p className="card-label">Servidor · Node.js</p>
            <p className={`status ${apiStatus}`} role="status" aria-live="polite">
              <span className="dot" aria-hidden="true" />{apiMessage}
            </p>
            <p className="card-text">
              {apiStatus === 'ready'
                ? 'La web recibe la respuesta de /api/health.'
                : apiStatus === 'error'
                  ? 'Revisa que los contenedores estén arrancados y consulta sus logs.'
                  : 'Esperando la respuesta de /api/health.'}
            </p>
          </article>
        </div>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={apiStatus === 'checking'}
        >
          {apiStatus === 'checking' ? 'Comprobando…' : 'Volver a comprobar'}
        </button>
      </section>

      <footer>Base de desarrollo · TR-02</footer>
    </main>
  );
}
