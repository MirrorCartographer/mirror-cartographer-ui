import React, { useMemo, useState } from 'react';

const sources = [
  {
    name: 'Cornell Feline Health Center',
    url: 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-immunodeficiency-virus-fiv',
    claim: 'Current practical baseline: no commercially available FIV vaccine in North America; prevention depends on exposure control and testing.'
  },
  {
    name: 'Frontiers in Veterinary Science, 2025 review',
    url: 'https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2025.1665999/full',
    claim: 'Current synthesis of FIV pathogenesis, antiretroviral/immunomodulator work, and vaccine-development barriers.'
  },
  {
    name: 'McDonnel et al., FIV latency',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3707804/',
    claim: 'FIV behaves as a lentiviral reservoir problem: integrated provirus and latency make sterilizing cure difficult.'
  },
  {
    name: 'Coleman et al., large vaccine efficacy study',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4304674/',
    claim: 'Dual-subtype whole-virus vaccine studies showed protection can happen, but efficacy is strain- and challenge-dependent.'
  },
  {
    name: 'Pu et al., heterologous subtype B vaccine study',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10911555/',
    claim: 'Fel-O-Vax FIV protected against a heterologous subtype B isolate under experimental conditions.'
  },
  {
    name: 'Westman et al., diagnostic interference',
    url: 'https://www.mdpi.com/1999-4915/13/3/470',
    claim: 'Vaccinated cats can develop antibodies that complicate diagnosis; modern algorithms must separate infection from vaccination history.'
  }
];

const evidence = [
  {
    grade: 'PROVEN',
    title: 'FIV is not just “cat AIDS”; it is a lentiviral integration problem.',
    body: 'FIV is a retrovirus/lentivirus. It reverse-transcribes RNA into DNA and integrates proviral DNA into host cells. That means a cure cannot only kill free virus. It must also control, silence, remove, or expose infected reservoir cells.',
    consequence: 'A true cure program must measure proviral DNA reservoirs, not just symptoms.'
  },
  {
    grade: 'PROVEN',
    title: 'A commercial FIV vaccine existed, but its field position collapsed.',
    body: 'The historic Fel-O-Vax FIV vaccine proved that protective immunity is biologically possible under some laboratory challenge conditions. It did not become a trusted universal solution because protection varied by strain and setting, and because antibody testing could not cleanly distinguish vaccination from infection.',
    consequence: 'The vaccine path is not impossible. It failed as a universal public-health object.'
  },
  {
    grade: 'PROVEN',
    title: 'No sterilizing cure is established in ordinary veterinary care.',
    body: 'Current clinical management centers on indoor housing, preventing bite exposure, treating secondary infections, dental care, parasite control, nutrition, and monitoring. Antiviral and immune approaches remain research-grade or limited, not a validated cure protocol.',
    consequence: 'The honest website must not sell false certainty. It must define the experiment that would turn plausibility into proof.'
  },
  {
    grade: 'PLAUSIBLE',
    title: 'The cure target is multi-layered: suppress, reveal, kill, rebuild.',
    body: 'The most rational cure architecture combines antiretroviral suppression, reservoir quantification, latency manipulation, immune clearance, and host immune restoration. A single magic molecule is unlikely because integrated latent provirus is structurally hidden from ordinary immune attack.',
    consequence: 'The cure plan should be a staged platform, not a single product claim.'
  },
  {
    grade: 'PLAUSIBLE',
    title: 'A next-generation vaccine must be diagnostic-aware from day one.',
    body: 'A useful FIV vaccine must protect across circulating subtypes, avoid or solve test ambiguity, and prove field benefit against natural bite exposure. It should not merely reproduce antibody positivity.',
    consequence: 'The vaccine plan must co-design immunogen, adjuvant, challenge model, and diagnostics.'
  },
  {
    grade: 'UNKNOWN',
    title: 'The missing proof is not “does immunity matter?” It is “which immunity generalizes?”',
    body: 'The hard unknown is whether a vaccine can induce broad, durable protection across divergent FIV strains without causing unacceptable diagnostic confusion or weak field effectiveness.',
    consequence: 'The research program must compare neutralizing antibodies, mucosal immunity, T-cell responses, and protection against heterologous naturalistic challenge.'
  }
];

const program = [
  {
    phase: '0',
    title: 'Truth boundary',
    output: 'Define exactly what counts as cure: functional remission, transmission blockade, or sterilizing elimination.',
    tests: ['FIV antibody + confirmatory testing', 'qPCR/ddPCR proviral load', 'viral RNA when available', 'CBC/chemistry', 'lymphocyte subsets if research setting']
  },
  {
    phase: '1',
    title: 'Map the infected cat',
    output: 'Create a longitudinal immune/viral profile instead of treating FIV status as one static label.',
    tests: ['Baseline dental/oral inflammation map', 'lymph-node exam/FNA when indicated', 'coinfection screen: FeLV, toxoplasma, hemoplasma as clinically indicated', 'inflammatory markers where available']
  },
  {
    phase: '2',
    title: 'Suppress replication safely',
    output: 'Evaluate antiretroviral candidates or combinations in controlled veterinary research conditions.',
    tests: ['Viral RNA reduction', 'proviral DNA trend', 'toxicity panel', 'quality-of-life score', 'secondary infection frequency']
  },
  {
    phase: '3',
    title: 'Expose reservoir',
    output: 'Test whether latency-reversal or immune-modulating strategies reveal infected cells without harming the cat.',
    tests: ['Reservoir reactivation signal', 'immune activation safety ceiling', 'tissue reservoir sampling where ethical', 'rebound after stopping suppression']
  },
  {
    phase: '4',
    title: 'Clear or contain',
    output: 'Pair exposure with immune clearance: therapeutic vaccine, engineered antibodies, cytotoxic T-cell enhancement, or other targeted immunotherapy.',
    tests: ['Drop in inducible reservoir', 'durable non-rebound window', 'absence of opportunistic disease', 'no immune-mediated damage']
  },
  {
    phase: '5',
    title: 'Prevent new infection',
    output: 'Build vaccine trials around broad subtype challenge and real diagnostic compatibility.',
    tests: ['Subtype A/B/C/D/E antigen coverage', 'neutralization breadth', 'T-cell breadth', 'naturalistic exposure model', 'DIVA-style diagnostic separation']
  }
];

const questions = [
  ['Why previous vaccine evidence matters', 'It proves FIV protection is biologically reachable. That is not the same as proving a universal vaccine. The signal survives; the product did not.'],
  ['Why cure is harder than FIP treatment', 'FIP is driven by feline coronavirus, not lentiviral integration. FIV hides as proviral DNA inside host cells. Removing or controlling that reservoir is the core problem.'],
  ['What “undeniable” can honestly mean', 'Not “a cure exists.” It means the reasoning chain is explicit enough that every missing link is named, testable, and fundable.'],
  ['What would change the world for FIV+ cats', 'A diagnostic-aware vaccine plus a functional-remission therapy would convert FIV from a stigmatized lifetime label into a measurable, managed, possibly reversible state.']
];

function SourceLink({ source }) {
  return (
    <a className="source" href={source.url} target="_blank" rel="noreferrer">
      <strong>{source.name}</strong>
      <span>{source.claim}</span>
    </a>
  );
}

function App() {
  const [mode, setMode] = useState('cure');
  const activeProgram = useMemo(() => program.filter((_, index) => mode === 'all' || (mode === 'cure' ? index < 5 : index === 0 || index === 5)), [mode]);

  return (
    <main className="fiv-page">
      <style>{styles}</style>

      <section className="hero">
        <div className="halo" aria-hidden="true" />
        <p className="eyebrow">Mirror Cartographer / FIV cure + vaccine proof map</p>
        <h1>FIV is curable only when the hidden reservoir becomes measurable.</h1>
        <p className="lede">
          This page does not pretend the cure already exists. It proves the strongest honest case:
          FIV cure and vaccine work are scientifically coherent, partially proven in components,
          blocked by specific known gaps, and ready to be organized as a rigorous translational program.
        </p>
        <div className="verdict-grid">
          <div><span>Current cure</span><b>Not proven</b></div>
          <div><span>Current North American vaccine</span><b>Not available</b></div>
          <div><span>Biological possibility</span><b>Yes</b></div>
          <div><span>Roadmap clarity</span><b>High</b></div>
        </div>
      </section>

      <section className="map">
        <article className="claim">
          <h2>The core theorem</h2>
          <p>
            A true FIV cure is not one intervention. It is a control system:
            stop new replication, find the integrated provirus, force or mark the hidden cells,
            clear those cells without damaging the cat, then prove durable non-rebound.
          </p>
        </article>
        <article className="claim warm">
          <h2>The vaccine theorem</h2>
          <p>
            A useful vaccine must do more than make antibodies. It must protect across FIV diversity,
            work in field-like exposure, and preserve diagnostic truth so vaccinated cats are not mislabeled as infected.
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Evidence ledger</p>
          <h2>What survives scrutiny</h2>
        </div>
        <div className="cards">
          {evidence.map((item) => (
            <article className="card" key={item.title}>
              <span className={`grade ${item.grade.toLowerCase()}`}>{item.grade}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <footer>{item.consequence}</footer>
            </article>
          ))}
        </div>
      </section>

      <section className="section dark">
        <div className="section-head">
          <p className="eyebrow">Program architecture</p>
          <h2>From infected cat to cure/vaccine platform</h2>
          <div className="tabs" role="group" aria-label="program filter">
            <button className={mode === 'cure' ? 'active' : ''} onClick={() => setMode('cure')}>Cure path</button>
            <button className={mode === 'vaccine' ? 'active' : ''} onClick={() => setMode('vaccine')}>Vaccine path</button>
            <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>All phases</button>
          </div>
        </div>

        <div className="timeline">
          {activeProgram.map((step) => (
            <article className="step" key={`${step.phase}-${step.title}`}>
              <div className="phase">{step.phase}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.output}</p>
                <ul>{step.tests.map((test) => <li key={test}>{test}</li>)}</ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="matrix">
        <div>
          <p className="eyebrow">Proof requirements</p>
          <h2>The minimum evidence that would deserve the word cure</h2>
        </div>
        <ol>
          <li><b>Suppression:</b> viral replication falls under therapy with acceptable safety.</li>
          <li><b>Reservoir measurement:</b> proviral DNA or inducible reservoir decreases, not just clinical symptoms.</li>
          <li><b>Durability:</b> the cat remains clinically stable after stopping or spacing therapy.</li>
          <li><b>Transmission logic:</b> infectious virus is absent or reduced below a defined transmission threshold.</li>
          <li><b>Replication:</b> results repeat across age, subtype, disease stage, and coinfection status.</li>
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Interpretive bridge</p>
          <h2>Why the old vaccine did not end the problem</h2>
        </div>
        <div className="qa">
          {questions.map(([q, a]) => (
            <article key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sources section">
        <div className="section-head">
          <p className="eyebrow">Primary evidence trail</p>
          <h2>Read the load-bearing sources</h2>
        </div>
        <div className="source-grid">
          {sources.map((source) => <SourceLink key={source.url} source={source} />)}
        </div>
      </section>

      <section className="final">
        <p className="eyebrow">Bottom line</p>
        <h2>The honest claim is stronger than the fake one.</h2>
        <p>
          “FIV is cured” is not proven. “FIV can be attacked as a definable lentiviral reservoir problem,
          and prior vaccine work proves protective immunity is not imaginary” is defensible. The next breakthrough
          is not a slogan. It is a diagnostic-aware cure/vaccine platform with explicit endpoints.
        </p>
      </section>
    </main>
  );
}

const styles = `
:root{color-scheme:dark}*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%}body{background:#05040a;color:#fff7ef;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.fiv-page{min-height:100vh;overflow:hidden;background:radial-gradient(circle at 12% 0%,rgba(255,85,130,.20),transparent 34%),radial-gradient(circle at 90% 8%,rgba(87,220,255,.18),transparent 30%),linear-gradient(180deg,#05040a,#0d0711 42%,#03040a);}.hero{position:relative;min-height:92vh;display:grid;place-content:center;padding:64px 22px 44px;text-align:left}.hero>*{position:relative;z-index:2;max-width:1120px}.halo{position:absolute;inset:12% 8% auto auto;width:min(62vw,680px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(255,226,145,.30),rgba(255,74,147,.16) 32%,rgba(80,220,255,.08) 54%,transparent 70%);filter:blur(8px);animation:pulse 9s ease-in-out infinite}.eyebrow{margin:0 0 16px;color:#ffd889;text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:800}.hero h1{font-size:clamp(48px,9vw,124px);letter-spacing:-.08em;line-height:.83;margin:0 0 24px;text-wrap:balance}.lede{font-size:clamp(18px,2.2vw,28px);line-height:1.34;color:#eadfeb;max-width:940px}.verdict-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:34px}.verdict-grid div,.card,.claim,.step,.qa article,.matrix,.source,.final{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);box-shadow:0 24px 80px rgba(0,0,0,.28);backdrop-filter:blur(18px)}.verdict-grid div{border-radius:24px;padding:18px}.verdict-grid span{display:block;color:#bdb3c8;font-size:12px;text-transform:uppercase;letter-spacing:.1em}.verdict-grid b{display:block;font-size:clamp(22px,3vw,36px);margin-top:8px}.map{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;max-width:1180px;margin:-40px auto 0;padding:0 22px 90px}.claim{border-radius:32px;padding:30px}.claim.warm{background:linear-gradient(135deg,rgba(255,216,137,.13),rgba(255,95,150,.07))}.claim h2,.section h2,.matrix h2,.final h2{font-size:clamp(32px,5vw,64px);letter-spacing:-.055em;line-height:.92;margin:0 0 18px}.claim p,.matrix li,.final p{font-size:18px;line-height:1.55;color:#eee4ed}.section{max-width:1220px;margin:0 auto;padding:70px 22px}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:24px}.section-head h2{max-width:850px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{min-height:330px;border-radius:28px;padding:24px;display:flex;flex-direction:column}.grade{align-self:flex-start;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;letter-spacing:.12em}.grade.proven{background:rgba(92,255,178,.12);color:#91ffc9}.grade.plausible{background:rgba(255,216,137,.14);color:#ffd889}.grade.unknown{background:rgba(255,95,150,.16);color:#ff9fbc}.card h3,.step h3,.qa h3{font-size:24px;line-height:1.05;letter-spacing:-.035em;margin:18px 0 12px}.card p,.step p,.qa p,.source span{color:#d9d0de;line-height:1.5}.card footer{margin-top:auto;color:#ffd889;border-top:1px solid rgba(255,255,255,.12);padding-top:14px;font-weight:750}.dark{max-width:none;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));}.dark>.section-head,.timeline{max-width:1220px;margin-left:auto;margin-right:auto}.tabs{display:flex;gap:8px;flex-wrap:wrap}.tabs button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer}.tabs button.active{background:#fff7ef;color:#08050b}.timeline{display:grid;gap:14px}.step{display:grid;grid-template-columns:76px 1fr;gap:20px;border-radius:28px;padding:22px}.phase{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#ffd889,#ff5f96);color:#16030b;font-size:24px;font-weight:1000}.step ul{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}.step li{border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:8px 10px;color:#fff4fa;background:rgba(255,255,255,.05);font-size:13px}.matrix{max-width:1180px;margin:80px auto;border-radius:34px;padding:32px;display:grid;grid-template-columns:.75fr 1.25fr;gap:28px}.matrix ol{margin:0;padding-left:24px}.matrix li{margin:0 0 12px}.qa{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.qa article{border-radius:24px;padding:20px}.source-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.source{display:block;text-decoration:none;color:#fff;border-radius:22px;padding:18px;transition:transform .2s ease,background .2s ease}.source:hover{transform:translateY(-2px);background:rgba(255,255,255,.09)}.source strong{display:block;color:#ffd889;margin-bottom:8px}.source span{display:block}.final{max-width:1180px;margin:40px auto 80px;border-radius:38px;padding:40px;background:linear-gradient(135deg,rgba(255,216,137,.16),rgba(80,220,255,.08),rgba(255,95,150,.12))}@keyframes pulse{0%,100%{transform:scale(.96);opacity:.68}50%{transform:scale(1.04);opacity:1}}@media(max-width:980px){.verdict-grid,.cards,.qa,.source-grid,.map,.matrix{grid-template-columns:1fr}.hero{min-height:auto;padding-top:76px}.section-head{display:block}.cards .card{min-height:auto}.map{margin:0;padding-bottom:50px}.matrix{margin:40px 22px}.verdict-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.verdict-grid{grid-template-columns:1fr}.step{grid-template-columns:1fr}.hero h1{font-size:50px}.section{padding:48px 16px}.final{margin:30px 16px;padding:26px}.matrix{padding:24px}.tabs{margin-top:14px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export default App;
