#!/usr/bin/env node

const REQUIRED_SECTIONS = [
  'Problem',
  'Implemented change',
  'Test evidence',
  'Risks',
  'Rollback',
  'Privacy review',
  'Next executable step',
];

const MIN_SECTION_LENGTH = 20;
const PLACEHOLDER_ONLY = /^(?:tbd|todo|n\/?a|none|pending|unknown|not yet|-)\.?$/i;

function cleanSectionText(value) {
  return value
    .replace(/<!--[^]*?-->/g, '')
    .replace(/^\s*[-*]\s*\[[ xX]\]\s*/gm, '')
    .replace(/^\s*[-*]\s*/gm, '')
    .replace(/[`*_>#]/g, '')
    .trim();
}

export function extractSections(body) {
  const normalized = String(body ?? '').replace(/\r\n?/g, '\n');
  const headingPattern = /^##\s+(.+?)\s*$/gm;
  const headings = [...normalized.matchAll(headingPattern)];
  const sections = new Map();

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const title = heading[1].trim();
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? normalized.length;
    sections.set(title, normalized.slice(start, end).trim());
  }

  return sections;
}

export function validatePullRequestBody(body) {
  const errors = [];
  const sections = extractSections(body);

  for (const title of REQUIRED_SECTIONS) {
    if (!sections.has(title)) {
      errors.push(`Missing required section: ## ${title}`);
      continue;
    }

    const cleaned = cleanSectionText(sections.get(title));
    if (cleaned.length < MIN_SECTION_LENGTH || PLACEHOLDER_ONLY.test(cleaned)) {
      errors.push(`Section ## ${title} is empty or not substantive.`);
    }
  }

  const testEvidence = cleanSectionText(sections.get('Test evidence') ?? '');
  if (testEvidence && !/(?:npm|node|python|pytest|playwright|test|build|lint|check|pass|fail|exit\s*code)/i.test(testEvidence)) {
    errors.push('Section ## Test evidence must name a command, check, or observed pass/fail result.');
  }

  const rollback = cleanSectionText(sections.get('Rollback') ?? '');
  if (rollback && !/(?:revert|disable|remove|restore|roll\s*back|delete|reset)/i.test(rollback)) {
    errors.push('Section ## Rollback must state a concrete reversal action.');
  }

  const privacy = cleanSectionText(sections.get('Privacy review') ?? '');
  if (privacy && !/(?:privacy|private|personal|credential|secret|redact|sensitive|no user data|no personal data)/i.test(privacy)) {
    errors.push('Section ## Privacy review must explicitly address private, personal, credential, secret, or sensitive data.');
  }

  return {
    ok: errors.length === 0,
    errors,
    sections: Object.fromEntries(sections),
  };
}

function readBodyFromArguments(argv, env) {
  const envFlagIndex = argv.indexOf('--body-env');
  if (envFlagIndex !== -1) {
    const envName = argv[envFlagIndex + 1];
    if (!envName) throw new Error('--body-env requires an environment variable name.');
    return env[envName] ?? '';
  }

  const bodyFlagIndex = argv.indexOf('--body');
  if (bodyFlagIndex !== -1) return argv[bodyFlagIndex + 1] ?? '';

  throw new Error('Provide --body <markdown> or --body-env <ENV_NAME>.');
}

function isDirectExecution() {
  return process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
}

if (isDirectExecution()) {
  try {
    const body = readBodyFromArguments(process.argv.slice(2), process.env);
    const result = validatePullRequestBody(body);

    if (!result.ok) {
      console.error('Automation PR gate failed:');
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log('Automation PR gate passed.');
    }
  } catch (error) {
    console.error(`Automation PR gate error: ${error.message}`);
    process.exitCode = 2;
  }
}
