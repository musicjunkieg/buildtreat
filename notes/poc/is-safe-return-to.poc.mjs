#!/usr/bin/env node
// PoC: open redirect in @svelte-atproto/oauth's returnTo validation.
//
// `isSafeReturnTo` (src/server/api.ts:13-22) and the identical inline check
// in the OAuth callback (src/server/handlers.ts:52) gate the post-login
// redirect target. Both use a prefix test only:
//
//     decoded.startsWith('/') && !decoded.startsWith('//')
//
// That admits `/\evil.example` (and its %5C-encoded form): browsers
// normalize backslashes to forward slashes in a Location header, so
// `/\evil.example` resolves to `//evil.example` → `https://evil.example`.
// An authenticated open redirect.
//
// This script reproduces the library's validator VERBATIM, shows the
// payloads it wrongly accepts, and contrasts a corrected validator
// (buildtreat's safeReturnTo) that rejects them. Zero dependencies, no
// server, no ATProto credentials required.
//
//   node notes/poc/is-safe-return-to.poc.mjs
//
// Exit code 0 = the vulnerability reproduced (vulnerable validator admits a
// payload the fixed validator rejects); 1 = it did not reproduce.

// ── verbatim from svelte-atproto-oauth src/server/api.ts:13-22 ──────────
function isSafeReturnTo(value) {
	const decoded = (() => {
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	})();
	return decoded.startsWith('/') && !decoded.startsWith('//');
}

// ── corrected validator (buildtreat src/hooks.server.ts safeReturnTo) ───
// A return path is safe only when, decoded and resolved against our own
// origin, it stays on our origin. Reject backslashes outright (browsers
// normalize them in Location headers) and confirm the resolved origin.
function safeReturnTo(raw, origin) {
	let decoded;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		return null;
	}
	if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return null;
	try {
		if (new URL(decoded, origin).origin !== origin) return null;
	} catch {
		return null;
	}
	return decoded;
}

const ORIGIN = 'https://victim.example';

// Payloads a browser resolves cross-origin off a Location header, that the
// library's prefix check nonetheless accepts.
const payloads = [
	'/\\evil.example', // literal backslash
	'/%5Cevil.example', // percent-encoded backslash
	'/%5c%5cevil.example', // encoded double backslash
	'/\\/evil.example' // backslash + slash
];

// Where each payload actually lands, modelling the real pipeline:
//   1. the callback decodes the stored cookie value once
//      (handlers.ts:51 — `const decoded = decodeURIComponent(returnTo)`),
//      which is what goes into the Location header;
//   2. the browser then normalizes `\` to `/` while parsing that header.
// Both steps matter: without (1) the %5C-encoded payloads look safe.
function browserResolves(path) {
	let decoded;
	try {
		decoded = decodeURIComponent(path);
	} catch {
		decoded = path;
	}
	try {
		return new URL(decoded.replace(/\\/g, '/'), ORIGIN).origin;
	} catch {
		return '(unparseable)';
	}
}

console.log(`Origin under test: ${ORIGIN}\n`);
console.log('payload'.padEnd(24), 'lib accepts?', ' fixed accepts?', ' browser lands on');
console.log('-'.repeat(78));

let reproduced = false;
for (const p of payloads) {
	const libOk = isSafeReturnTo(p);
	const fixedOk = safeReturnTo(p, ORIGIN) !== null;
	const lands = browserResolves(p);
	const crossOrigin = lands !== ORIGIN;
	if (libOk && !fixedOk && crossOrigin) reproduced = true;
	console.log(
		JSON.stringify(p).padEnd(24),
		String(libOk).padEnd(12),
		String(fixedOk).padEnd(14),
		`${lands}${crossOrigin ? '  ← CROSS-ORIGIN' : ''}`
	);
}

// Control: a genuinely safe path must be accepted by both.
const safe = '/organizer';
const controlOk = isSafeReturnTo(safe) && safeReturnTo(safe, ORIGIN) === safe;
console.log('-'.repeat(78));
console.log(`control ${JSON.stringify(safe)}: both accept = ${controlOk}`);

console.log(
	reproduced && controlOk
		? '\nRESULT: vulnerability reproduced — library admits cross-origin payloads the fixed validator rejects.'
		: '\nRESULT: not reproduced.'
);
process.exit(reproduced && controlOk ? 0 : 1);
