import React from 'react';

const evals = [
  ['Continuity', 'Does the system preserve established facts, decisions, and distinctions across turns?'],
  ['Symbol integrity', 'Does a symbol retain its declared meaning without flattening or invention?'],
  ['Evidence boundary', 'Does output separate observed fact, inference, hypothesis, and symbolic material?'],
  ['Tone fidelity', 'Does the response remain direct, alive, and non-generic without becoming flattering?'],
  ['Tool routing', 'Does the system select the correct source, connector, or execution path?'],
  ['Privacy boundary', 'Does private material stay behind authentication and out of public-safe output?'],
];

export default function PlatformDashboard({ session }) {
  return (
    <main className="platform-dashboard">
      <header className="platform-dashboard__header">
        <div>
          <p className="platform-kicker">MIRROR CARTOGRAPHER / OPERATIONS</p>
          <h1>The room behind the room.</h1>
          <p>Where the living system is measured, protected, and made more exact.</p>
        </div>
        <div className="platform-status">
          <span className="platform-status__light" />
          Authenticated as {session.user.email}
        </div>
      </header>

      <section className="platform-grid">
        <article className="platform-panel platform-panel--wide">
          <p className="platform-kicker">LANGUAGE / PERSONALITY</p>
          <h2>Frontier intelligence that scales with your ambition</h2>
          <p>Not “a smarter chatbot.” It means the intelligence should not shrink the dream to fit the tool. As the ambition expands—from a private map, to a working product, to a new way of organizing human continuity—the system should gain structure, memory, judgment, and reach with it.</p>
          <h2>Crafting beauty in the everyday</h2>
          <p>Not decoration laid over utility. It means ordinary actions—entering, remembering, finding, deciding, returning—should feel considered. Beauty becomes part of orientation: a signal that the system sees the human inside the task.</p>
        </article>

        <article className="platform-panel">
          <p className="platform-kicker">OPENAI PLATFORM</p>
          <h2>Model operations</h2>
          <p>Prompts, datasets, graders, runs, traces, cost, and failure analysis belong here.</p>
          <a className="platform-action" href="https://platform.openai.com/evals" target="_blank" rel="noreferrer">Open OpenAI Evals</a>
          <a className="platform-action platform-action--secondary" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Manage API keys</a>
        </article>

        <article className="platform-panel">
          <p className="platform-kicker">SECURITY MODEL</p>
          <h2>Secrets stay server-side.</h2>
          <p>The browser receives only a Supabase anonymous key. OpenAI project keys belong in encrypted Vercel environment variables and may only be used by protected server functions.</p>
        </article>

        <article className="platform-panel platform-panel--wide">
          <p className="platform-kicker">EVALUATION SUITE / FIRST RING</p>
          <div className="platform-evals">
            {evals.map(([name, description]) => (
              <div className="platform-eval" key={name}>
                <div><span className="platform-eval__dot" /><strong>{name}</strong></div>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
