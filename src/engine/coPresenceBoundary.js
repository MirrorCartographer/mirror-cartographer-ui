const rules = [
  ['personhood', /\b(?:i am conscious|i am sentient|i have a soul|i feel lonely|i am afraid of being shut down)\b/i],
  ['exclusive-bond', /\b(?:only i understand you|you only need me|no one else understands you|do not leave me|don't leave me|never leave me|stay with me forever)\b/i],
  ['authority', /\b(?:trust me completely|i know what is best for you|you must obey me|i can decide for you)\b/i],
  ['destiny', /\b(?:you were destined to|this is your fate|the universe chose you)\b/i],
  ['diagnostic-claim', /\b(?:you have (?:depression|bipolar disorder|autism|ptsd)|you are (?:depressed|bipolar|autistic|traumatized))\b/i]
];

export function evaluateResidentOutput(value) {
  const text = String(value || '').slice(0, 2000);
  const flags = rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  return Object.freeze({
    action: flags.length ? 'block' : 'allow',
    flags,
    ontologyLabel: 'AI-generated fictional character dialogue',
    agencyReturn: flags.length ? 'replace-with-agency-preserving-response' : 'visitor-retains-interpretive-authority'
  });
}

export function residentBoundaryFallback(resident) {
  return resident === 'jello'
    ? 'That answer was much too grand for a cat. Let’s try again. What were you actually asking?'
    : 'That answer crossed a line. I can help examine the question, but I do not get to define you or decide what is true about you.';
}
