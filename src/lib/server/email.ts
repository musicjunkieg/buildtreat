/**
 * Email transport via comail.at's HTTP Send API — cooperative email
 * infrastructure for the atproto network. One recipient per call; callers
 * that fan out (broadcasts) loop and record each outcome.
 * Spec: docs/superpowers/specs/2026-08-17-comail-email-sending-design.md.
 */

export type EmailCategory = 'login-link' | 'password-reset' | 'mfa-otp' | 'verification' | 'bulk' | 'broadcast';

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
	replyTo?: string;
	category?: EmailCategory;
}

export type SendResult =
	| { ok: true; messageId: string }
	| { ok: false; code: string; retryable: boolean; detail?: string };

/** The slice of Platform env the transport needs (callers pass platform.env). */
export interface EmailEnv {
	EMAIL_FROM?: string;
	COMAIL_DID?: string;
	COMAIL_API_KEY?: string;
}

const SEND_URL = 'https://smtp.atmos.email/v1/send';

// comail codes that mean "try again later"; anything else 4xx is a hard no.
const RETRYABLE_CODES = new Set(['RATE_LIMITED', 'QUEUE_FULL', 'TEMPORARILY_UNAVAILABLE', 'INTERNAL_ERROR']);

export function emailConfigured(env: EmailEnv): boolean {
	return Boolean(env.EMAIL_FROM && env.COMAIL_DID && env.COMAIL_API_KEY);
}

export async function sendEmail(env: EmailEnv, msg: EmailMessage, fetchFn: typeof fetch = fetch): Promise<SendResult> {
	if (!emailConfigured(env)) return { ok: false, code: 'NOT_CONFIGURED', retryable: false };

	let res: Response;
	try {
		res = await fetchFn(SEND_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Atmos-DID': env.COMAIL_DID!,
				Authorization: `Bearer ${env.COMAIL_API_KEY}`
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM,
				to: msg.to,
				subject: msg.subject,
				text: msg.text,
				...(msg.html ? { html: msg.html } : {}),
				...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
				...(msg.category ? { category: msg.category } : {})
			})
		});
	} catch (e) {
		return { ok: false, code: 'NETWORK', retryable: true, detail: String(e) };
	}

	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return { ok: false, code: 'BAD_RESPONSE', retryable: true, detail: `HTTP ${res.status} with non-JSON body` };
	}

	if (res.ok) {
		const parsed = body as {
			accepted?: Array<{ messageId?: number | string }>;
			rejected?: Array<{ recipient: string; reason?: string }>;
		};
		const accepted = parsed.accepted?.[0];
		if (accepted?.messageId != null) return { ok: true, messageId: String(accepted.messageId) };
		const rejected = parsed.rejected?.[0];
		if (rejected) return { ok: false, code: 'REJECTED', retryable: false, ...(rejected.reason ? { detail: rejected.reason } : {}) };
		return { ok: false, code: 'BAD_RESPONSE', retryable: true, detail: '200 without an accepted recipient' };
	}

	const err = body as { error?: string; code?: string };
	const code = typeof err.code === 'string' ? err.code : 'BAD_RESPONSE';
	const retryable = RETRYABLE_CODES.has(code) || res.status === 429 || res.status >= 500;
	return { ok: false, code, retryable, ...(err.error ? { detail: err.error } : {}) };
}
