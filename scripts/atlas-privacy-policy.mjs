import { basename, extname } from 'node:path';

const BLOCKED_PATH = /(^|\/)(private|secrets?|credentials?|personal-records?|raw-private|raw-conversations?|conversations?|chat-history|chat-logs?|transcripts?|journals?|diaries?|conversation-exports?|chat-exports?|medical-records?|health-records?|veterinary-records?|pet-records?|financial-records?|bank-records?|medical-data|health-data|veterinary-data|pet-health-data|financial-data|bank-data|private-notes?|raw-notes?)(\/|$)|(^|\/)\.env($|\.)|(^|\/)(node_modules|\.git)(\/|$)/i;
const BLOCKED_PRIVATE_BASENAME = /^(?:(?:raw[-_ ]?(?:private[-_ ]?)?|private[-_ ]?)(?:conversations?|notes?|journals?|diaries?|transcripts?|chat[-_ ]?(?:history|logs?))|(?:conversation|chat[-_ ]?(?:history|logs?)|transcript|journal|diary)[-_ ]?(?:export|log|history|transcript|raw|private)|conversations?|chat[-_ ]?(?:history|logs?)|transcripts?|journals?|diaries?)(?:\.[^.]+)?$/i;
const CREDENTIAL_EXTENSIONS = new Set([
  '.pem', '.key', '.p12', '.pfx', '.sqlite', '.db', '.dump', '.bak', '.kdbx', '.gpg', '.age', '.asc',
]);
const CREDENTIAL_BASENAME = /^(id_rsa|id_ed25519|authorized_keys|credentials?|secrets?|tokens?|passwords?)(\..*)?$/i;

export function isPrivateCatalogPath(path) {
  if (typeof path !== 'string' || !path) return true;
  return BLOCKED_PATH.test(path) || BLOCKED_PRIVATE_BASENAME.test(basename(path));
}

export function isCredentialLikeFile(path) {
  if (typeof path !== 'string' || !path) return true;
  return CREDENTIAL_EXTENSIONS.has(extname(path).toLowerCase())
    || CREDENTIAL_BASENAME.test(basename(path));
}
