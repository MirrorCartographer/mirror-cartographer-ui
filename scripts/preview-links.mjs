const port = process.env.PORT || '5173';
const localUrl = `http://localhost:${port}`;

const codespace = process.env.CODESPACE_NAME;
const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const remoteUrl = codespace && domain
  ? `https://${codespace}-${port}.${domain}`
  : null;

console.log('\nMirror Cartographer preview links');
console.log(`Local:      ${localUrl}`);

if (remoteUrl) {
  console.log(`Codespaces: ${remoteUrl}`);
  console.log('Visibility: private by default; use the Codespaces Ports panel to share it.');
} else {
  console.log('Codespaces: available after opening this repository in GitHub Codespaces.');
}

console.log('');
