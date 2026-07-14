export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.status(410).send('Gone');
}
