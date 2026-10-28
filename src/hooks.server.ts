import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sessionUser, userCount } from '#lib/server/auth.ts';
import { UPLOAD_DIR } from '#lib/server/db.ts';
import { resumeProcessing } from '#lib/server/process.ts';

export const init: ServerInit = () => {
	resumeProcessing();
	// Uploads abandoned for over 3 days
	for (const f of readdirSync(UPLOAD_DIR)) {
		const path = join(UPLOAD_DIR, f);
		if (Date.now() - statSync(path).mtimeMs > 3 * 86_400_000) rmSync(path, { force: true });
	}
};

// Everything is private except these.
const PUBLIC_PATHS = ['/login', '/setup', '/invite/'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = sessionUser(event.cookies);

	const path = event.url.pathname;
	if (!event.locals.user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
		if (path.startsWith('/api/')) return new Response('Please log in again.', { status: 401 });
		// First run: nobody exists yet, so send the owner to create the first account.
		const location = userCount() === 0 ? '/setup' : '/login';
		return new Response(null, { status: 303, headers: { location } });
	}

	return resolve(event);
};
