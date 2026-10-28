// Starts the built site: `node server.js` (instead of `node build`).
//
// The site is reached two ways: straight over plain http at home (http://192.168.1.50) and
// through Cloudflare Tunnel or another proxy over https. The proxy says which one in the
// X-Forwarded-Proto header; a request without it came straight in over http. Without this,
// the server would assume https for everything, and logging in at home would silently fail.
import { createServer } from 'node:http';

process.env.PROTOCOL_HEADER ||= 'x-forwarded-proto';
process.env.HOST_HEADER ||= 'x-forwarded-host';
const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

createServer((req, res) => {
	req.headers['x-forwarded-proto'] ??= 'http';
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
}).listen(port, host, () => console.log(`Family archive running on http://${host}:${port}`));
