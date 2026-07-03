import React, { useMemo, useState } from 'react';

const citations = [
  ['Cornell Feline Health Center', 'No commercially available FIV vaccine in North America; core prevention remains exposure control, testing, and indoor management.', 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-immunodeficiency-virus-fiv'],
  ['Westman et al., Viruses 2021', 'Vaccination created anti-p24 and anti-gp40 antibodies in PCR-negative cats; SNAP Combo showed 0% specificity in annually vaccinated cats, while Witness and Anigen Rapid showed 100% specificity in that annual-booster cohort.', 'https://www.mdpi.com/1999-4915/13/3/470'],
  ['Frontiers in Veterinary Science 2025', 'FIV genetic diversity and subtypes block universal vaccine performance; field effectiveness remains uncertain; HIV-derived antivirals are limited by toxicity, resistance, and poor feline-specific evidence.', 'https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2025.1665999/full'],
  ['McDonnel, Sparger & Murphy, Retrovirology 2013', 'FIV latency makes cure a reservoir problem: integrated proviral DNA can persist beyond free-virus suppression.', 'https://retrovirology.biomedcentral.com/articles/10.1186/1742-4690-10-69'],
  ['Pu et al., JFMS 2005', 'Dual-subtype Fel-O-Vax protected vaccinated cats against one heterologous subtype B challenge, showing protection is biologically possible under defined conditions.', 'https://doi.org/10.1016/j.jfms.2004.08.005'],
  ['Stickney et al., Veterinary Microbiology 2020', 'A New Zealand field study reported lack of protection among vaccinated outdoor-access domestic cats, highlighting the lab-to-field gap.', 'https://doi.org/10.1016/j.vetmic.2020.108865']
];

const missingPieces = [
  {
    title: '1. A feline-safe suppressive backbone',
    text: 'Before cure, replication must be held down safely. HIV drugs cannot simply be copied into cats: some are ineffective, toxic, or resistance-prone. The missing object is a cat-compatible combination therapy with good pharmacokinetics, low toxicity, broad clade activity, and a high resistance barrier.'
  },
  {
    title: '2. A live reservoir assay',
    text: 'A cure cannot be proven by a cat looking better. The missing assay must quantify integrated proviral DNA, inducible reservoir, and rebound risk. Without that, every therapy is only symptom management or partial suppression.'
  },
  {
    title: '3. A reservoir intervention',
    text: 'Sterilizing cure needs hidden infected cells eliminated or permanently silenced. Functional cure needs durable immune control without continuous therapy. The missing intervention is either shock-and-kill, block-and-lock, gene editing, immune clearance, or a hybrid that works in feline cells safely.'
  },
  {
    title: '4. A diagnostic-aware vaccine',
    text: 'The vaccine must be designed with a companion test from the first experiment. That means either DIVA logic, antigen panels not confused by vaccine antibodies, PCR/proviral confirmation, or immune signatures that separate vaccination from infection.'
  },
  {
    title: '5. Field-generalizing immunity',
    text: 'The vaccine must protect against diverse circulating FIV subtypes and recombinant strains, not only a lab challenge strain. The missing immune target is broad, durable protection: neutralization plus T-cell and mucosal defense against realistic bite/saliva exposure.'
  }
];

const diagnosticChain = [
  ['Vaccination event', 'Fel-O-Vax exposes the immune system to inactivated whole-virus / infected-cell antigens.'],
  ['Antibody production', 'The cat produces antibodies against viral proteins such as p24 capsid and gp40 transmembrane envelope.'],
  ['Old test logic', 'Many point-of-care tests ask: “Are anti-FIV antibodies present?” That question does not ask whether active infection exists.'],
  ['Collision', 'Vaccinated-uninfected cats can look serologically similar to infected cats, especially when a test detects vaccine-induced antibody targets.'],
  ['Public-health harm', 'In shelters, rescues, adoption, and multi-cat homes, an ambiguous positive can lead to isolation, stigma, failed adoption, or euthanasia.'],
  ['Fix', 'Use diagnostic-aware design: vaccine antigen choices + tests that distinguish vaccine antibodies from infection antibodies + PCR/proviral confirmation where ambiguity matters.']
];

const failureReasons = [
  {
    name: 'Diagnostic interference',
    details: 'The vaccine trained the immune system to make antibodies that some tests also use as infection markers. That broke trust in routine testing.'
  },
  {
    name: 'Subtype diversity',
    details: 'FIV is not one fixed target. Subtypes and recombinant strains mean a vaccine that works against one challenge may fail against another.'
  },
  {
    name: 'Lab-to-field gap',
    details: 'Controlled challenge studies can show protection, while outdoor-access field populations face different strains, doses, timing, bite exposures, and immune histories.'
  },
  {
    name: 'Non-core status',
    details: 'Because FIV risk is concentrated in cats with outdoor access/fighting exposure, the vaccine never became a simple universal kitten-series object like core vaccines.'
  },
  {
    name: 'Commercial trust collapse',
    details: 'When a product complicates diagnosis and has variable field protection, veterinarians, shelters, and owners cannot use it as a clean public-health instrument.'
  }
];

const cureHypothesis = [
  'Suppress active replication with feline-specific combination antiretroviral therapy or equivalent anti-entry/integrase strategy.',
  'Measure the reservoir with ddPCR/proviral DNA plus inducible virus assays so cure endpoints are not imaginary.',
  'Stratify cats by subtype, viral load, age, oral inflammation, lymph-node status, coinfections, and immune exhaustion.',
  'Apply a reservoir strategy: latency reversal plus immune clearance, permanent transcriptional silencing, targeted gene editing, or therapeutic vaccination.',
  'Prove non-rebound after treatment interruption or spacing, with strict rescue criteria and welfare oversight.',
  'Pair preventive vaccine development with a DIVA-compatible diagnostic algorithm so vaccination never destroys infection truth again.'
];

const vaccineHypothesis = [
  'Build a multi-epitope or mosaic vaccine covering conserved Env/Gag/Pol regions across FIV subtypes, not only historical subtype A/D strains.',
  'Induce mucosal immunity relevant to saliva/bite exposure, cytotoxic T-cell responses for infected-cell control, and broadly neutralizing or entry-blocking antibodies where possible.',
  'Use adjuvants and delivery routes validated for cats, not merely borrowed immunology.',
  'Pre-register challenge endpoints: sterilizing protection, reduced proviral integration, reduced viral set point, and blocked transmission.',
  'Co-develop companion diagnostics: gp40-focused tests, multiplex antibody patterning, PCR/proviral confirmation, and vaccination records/markers.',
  'Test under field-like conditions with natural subtype surveillance before calling it universal.'
];

const workups = [
  ['Clinical floor', 'CBC/chemistry, dental/oral disease staging, lymph-node map, weight trend, fever/infection history, kidney/urinary monitoring.'],
  ['Viral identity', 'Confirm FIV status with antibody + appropriate confirmatory testing; use PCR/proviral DNA when vaccination history or discordance creates ambiguity.'],
  ['Subtype map', 'Sequence viral regions where possible. A universal vaccine cannot be proven without knowing which FIV diversity it covers.'],
  ['Reservoir quantification', 'Track proviral DNA and inducible reservoir, not only free virus or symptoms.'],
  ['Immune state', 'Measure CD4/CD8 patterns, T-cell exhaustion/function, inflammatory burden, and coinfections where research resources permit.'],
  ['Trial gates', 'Safety, suppression, reservoir effect, rebound, transmission risk, field replication. No gate can be skipped.']
];

function Card({ title, children }) {
  return <article className="card"><h3>{title}</h3>{children}</article>;
}

export default function App() {
  const [view, setView] = useState('cure');
  const hypothesis = useMemo(() => view === 'cure' ? cureHypothesis : vaccineHypothesis, [view]);

  return (
    <main className="page">
      <style>{styles}</style>
      <section className="hero">
        <p className="eyebrow">Mirror Cartographer / FIV proof case file</p>
        <h1>The missing cure piece is reservoir control with diagnostic truth.</h1>
        <p className="lede">The strongest honest claim is not “FIV is cured.” The strongest claim is that FIV cure and vaccine development are blocked by specific, solvable engineering-biological failures: latent integrated reservoir, feline-safe suppression, strain diversity, field validation, and vaccine-test confusion.</p>
        <div className="thesis"><b>Central hypothesis:</b> FIV becomes curable when active replication can be safely suppressed, latent reservoir can be measured and reduced or permanently silenced, immune clearance can be rebuilt, and vaccine-induced immunity can be separated from true infection.</div>
      </section>

      <section className="section split">
        <div><p className="eyebrow">Missing piece</p><h2>Not one molecule. A linked system.</h2></div>
        <div className="stack">{missingPieces.map(x => <Card key={x.title} title={x.title}><p>{x.text}</p></Card>)}</div>
      </section>

      <section className="section dark">
        <p className="eyebrow">Why antibody testing broke</p>
        <h2>Vaccination and infection shared the same visible signal.</h2>
        <div className="chain">{diagnosticChain.map(([a,b],i)=><div className="node" key={a}><span>{i+1}</span><h3>{a}</h3><p>{b}</p></div>)}</div>
        <div className="fix"><h3>The fix</h3><p>Do not rely on a single yes/no antibody result after vaccination. Use a DIVA-style strategy: choose vaccine antigens that do not duplicate diagnostic targets, use tests validated in vaccinated cats, add PCR/proviral DNA confirmation where stakes are high, and build vaccination history into the diagnostic algorithm. The 2021 Westman study shows this is partly fixable because different point-of-care kits behaved very differently in vaccinated PCR-negative cats.</p></div>
      </section>

      <section className="section">
        <p className="eyebrow">Why the old vaccine failed as public health</p>
        <h2>It was biologically interesting but operationally unstable.</h2>
        <div className="cards">{failureReasons.map(x => <Card key={x.name} title={x.name}><p>{x.details}</p></Card>)}</div>
      </section>

      <section className="section dark">
        <div className="sectionrow"><div><p className="eyebrow">Next hypothesis</p><h2>{view === 'cure' ? 'What must happen next to make a cure' : 'What must happen next to make a vaccine'}</h2></div><div className="tabs"><button className={view==='cure'?'active':''} onClick={()=>setView('cure')}>Cure</button><button className={view==='vaccine'?'active':''} onClick={()=>setView('vaccine')}>Vaccine</button></div></div>
        <ol className="hypothesis">{hypothesis.map(x => <li key={x}>{x}</li>)}</ol>
      </section>

      <section className="section split">
        <div><p className="eyebrow">Diagnostics / workup</p><h2>What must be measured so the work cannot fool itself.</h2></div>
        <div className="stack">{workups.map(([a,b]) => <Card key={a} title={a}><p>{b}</p></Card>)}</div>
      </section>

      <section className="section matrix">
        <p className="eyebrow">Chain trails</p>
        <h2>Where the cure is blocked</h2>
        <div className="trail"><b>Virus trail:</b> exposure → infection → reverse transcription → proviral integration → latent reservoir → immune evasion → rebound risk.</div>
        <div className="trail"><b>Therapy trail:</b> drug candidate → feline cell activity → cat pharmacokinetics → toxicity ceiling → resistance barrier → long-term adherence → field cost.</div>
        <div className="trail"><b>Vaccine trail:</b> antigen choice → adjuvant/delivery → mucosal + T-cell + antibody response → subtype coverage → challenge protection → field protection → diagnostic compatibility.</div>
        <div className="trail"><b>Diagnostic trail:</b> antibody target → vaccine antibody overlap → false positive risk → shelter/adoption harm → validated alternate kit/PCR → trust restored.</div>
      </section>

      <section className="section sources">
        <p className="eyebrow">Evidence ledger</p>
        <h2>Load-bearing sources</h2>
        <div className="sourcegrid">{citations.map(([name, claim, url]) => <a className="source" href={url} target="_blank" rel="noreferrer" key={url}><strong>{name}</strong><span>{claim}</span></a>)}</div>
      </section>
    </main>
  );
}

const styles = `
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#05040a;color:#fff7ef;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{background:radial-gradient(circle at 8% 0%,rgba(255,91,137,.22),transparent 32%),radial-gradient(circle at 86% 10%,rgba(89,216,255,.18),transparent 32%),linear-gradient(180deg,#05040a,#100813 45%,#04050a);min-height:100vh}.hero{min-height:86vh;display:grid;place-content:center;padding:72px 24px 44px}.hero>*{max-width:1160px}.eyebrow{color:#ffda8a;text-transform:uppercase;letter-spacing:.18em;font-weight:900;font-size:12px;margin:0 0 16px}.hero h1{font-size:clamp(48px,8vw,118px);line-height:.84;letter-spacing:-.08em;margin:0 0 24px;text-wrap:balance}.lede{font-size:clamp(18px,2.2vw,28px);line-height:1.35;color:#eadfec;max-width:980px}.thesis{border:1px solid rgba(255,255,255,.16);background:linear-gradient(135deg,rgba(255,218,138,.16),rgba(89,216,255,.08));border-radius:28px;padding:22px;margin-top:28px;font-size:20px;line-height:1.45}.section{max-width:1220px;margin:0 auto;padding:72px 24px}.section h2{font-size:clamp(34px,5vw,70px);line-height:.92;letter-spacing:-.06em;margin:0 0 28px}.split{display:grid;grid-template-columns:.75fr 1.25fr;gap:28px}.stack{display:grid;gap:14px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card,.node,.fix,.trail,.source{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:26px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.24);backdrop-filter:blur(18px)}.card h3,.node h3,.fix h3{font-size:24px;line-height:1.05;margin:0 0 12px;letter-spacing:-.035em}.card p,.node p,.fix p,.trail,.source span,.hypothesis li{color:#ded4e3;line-height:1.55;font-size:16px}.dark{max-width:none;background:rgba(255,255,255,.035)}.dark>*{max-width:1220px;margin-left:auto;margin-right:auto}.chain{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.node span{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#ffda8a;color:#13050c;font-weight:1000;margin-bottom:16px}.fix{margin-top:16px;background:linear-gradient(135deg,rgba(255,218,138,.13),rgba(255,91,137,.08))}.sectionrow{display:flex;align-items:end;justify-content:space-between;gap:22px}.tabs{display:flex;gap:10px}.tabs button{border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.06);color:white;font-weight:1000;padding:12px 16px;cursor:pointer}.tabs button.active{background:#fff7ef;color:#08040a}.hypothesis{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:0;padding:0;list-style:none}.hypothesis li{border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:18px;background:rgba(255,255,255,.05)}.matrix{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.matrix h2,.matrix .eyebrow{grid-column:1/-1}.trail b{color:#ffda8a}.sourcegrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.source{display:block;color:#fff;text-decoration:none;transition:.2s ease}.source:hover{transform:translateY(-2px);background:rgba(255,255,255,.09)}.source strong{display:block;color:#ffda8a;margin-bottom:8px;font-size:18px}@media(max-width:950px){.split,.cards,.chain,.hypothesis,.matrix,.sourcegrid{grid-template-columns:1fr}.sectionrow{display:block}.tabs{margin-bottom:22px}.hero{min-height:auto}.section{padding:48px 18px}}`;
