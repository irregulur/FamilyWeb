import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { db } from './db.ts';

export type User = { id: number; name: string; email: string; is_admin: number };

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 180; // family shouldn't have to log in often
const INVITE_DAYS = 30;
const DAY = 86_400_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function hashPassword(password: string) {
	const salt = randomBytes(16);
	return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored: string) {
	const [salt, hash] = stored.split(':');
	const actual = scryptSync(password, Buffer.from(salt, 'hex'), 64);
	return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

export function userCount() {
	return (db.prepare('SELECT count(*) AS n FROM users').get() as { n: number }).n;
}

export function createUser(name: string, email: string, password: string, isAdmin = false) {
	const r = db
		.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)')
		.run(name, email, hashPassword(password), isAdmin ? 1 : 0);
	return Number(r.lastInsertRowid);
}

/** Returns the user id, or null if the email/password don't match. */
export function checkLogin(email: string, password: string) {
	const row = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email) as
		| { id: number; password_hash: string }
		| undefined;
	return row && verifyPassword(password, row.password_hash) ? row.id : null;
}

export function startSession(cookies: Cookies, userId: number, url: URL) {
	const token = randomBytes(32).toString('base64url');
	db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
		sha256(token),
		userId,
		Date.now() + SESSION_DAYS * DAY
	);
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// On the home network the site may be plain http; behind the tunnel it's https.
		secure: url.protocol === 'https:',
		maxAge: SESSION_DAYS * 86_400
	});
}

export function sessionUser(cookies: Cookies): User | null {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const user = db
		.prepare(
			`SELECT u.id, u.name, u.email, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ? AND s.expires_at > ?`
		)
		.get(sha256(token), Date.now()) as User | undefined;
	return user ?? null;
}

export function endSession(cookies: Cookies) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function createInvite(note: string, createdBy: number) {
	const code = randomBytes(12).toString('base64url');
	db.prepare('INSERT INTO invites (code, note, created_by, expires_at) VALUES (?, ?, ?, ?)').run(
		code,
		note || null,
		createdBy,
		Date.now() + INVITE_DAYS * DAY
	);
	return code;
}

export function openInvite(code: string) {
	return db
		.prepare('SELECT code, note FROM invites WHERE code = ? AND used_by IS NULL AND expires_at > ?')
		.get(code, Date.now()) as { code: string; note: string | null } | undefined;
}

export function useInvite(code: string, userId: number) {
	db.prepare('UPDATE invites SET used_by = ? WHERE code = ?').run(userId, code);
}

/** Shared validation for setup + invite sign-up forms. */
export function readSignup(form: FormData) {
	const name = String(form.get('name') ?? '').trim();
	const email = String(form.get('email') ?? '').trim().toLowerCase();
	const password = String(form.get('password') ?? '');
	if (!name || !email.includes('@')) return { error: 'Please fill in your name and email.', name, email };
	if (password.length < 8) return { error: 'Password needs at least 8 characters.', name, email };
	if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
		return { error: 'That email already has an account — try logging in.', name, email };
	return { name, email, password };
}
