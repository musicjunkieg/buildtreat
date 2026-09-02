/**
 * Branded HTML email rendering — The Dusk Feed translated to email-client
 * constraints. Table layout, inline styles, solid hex stand-ins for the ink
 * opacity steps (Outlook's Word engine ignores rgba), Arial Narrow carrying
 * the display voice where Big Shoulders can't load. The plain-text version
 * of every message stays the author's untouched text; this module only
 * produces the html alternative.
 */

import { retreatDates, retreatLocation } from '../content';

export interface EmailFact {
	label: string;
	value: string;
}

export interface BrandedEmailOptions {
	/** Display headline, rendered stacked and uppercase. */
	heading: string;
	/** Plain text; blank lines split paragraphs, single newlines become <br>. */
	body: string;
	/** Hairline ledger rows shown under the headline. */
	facts?: EmailFact[];
	cta?: { label: string; url: string };
	/** Quiet closing line under the final hairline. */
	footer?: string;
}

// Ink opacity steps composited onto the #0b0908 ground, as solid hex.
const GROUND = '#0b0908';
const INK = '#ffffff';
const INK_70 = '#b9b8b7';
const INK_45 = '#7c7b7a';
const INK_35 = '#636261';
const HAIRLINE = `1px solid ${INK_35}`;

const DISPLAY_STACK = "'Big Shoulders','Arial Narrow','Helvetica Neue',Arial,sans-serif";
const BODY_STACK = "'Hanken Grotesk',Helvetica,Arial,sans-serif";

export function escapeHtml(s: string): string {
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Turn bare http(s) URLs in already-escaped text into white underlined links. */
function linkify(escaped: string): string {
	return escaped.replace(
		/https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*/g,
		(url) => `<a href="${url}" style="color:${INK};text-decoration:underline;">${url}</a>`
	);
}

function paragraphs(body: string): string {
	return body
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map(
			(p) =>
				`<p style="margin:0 0 16px;font-family:${BODY_STACK};font-size:16px;line-height:1.55;color:${INK_70};">${linkify(escapeHtml(p)).replaceAll('\n', '<br>')}</p>`
		)
		.join('\n');
}

function factRows(facts: EmailFact[]): string {
	return facts
		.map(
			(f) => `<tr>
<td style="padding:11px 0;border-top:${HAIRLINE};font-family:${BODY_STACK};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${INK_70};">${escapeHtml(f.label)}</td>
<td align="right" style="padding:11px 0 11px 16px;border-top:${HAIRLINE};font-family:${BODY_STACK};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold;color:${INK};">${escapeHtml(f.value)}</td>
</tr>`
		)
		.join('\n');
}

export function brandedEmail(opts: BrandedEmailOptions): string {
	const preheader = opts.body.replace(/\s+/g, ' ').trim().slice(0, 120);
	const facts = opts.facts?.length
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-bottom:${HAIRLINE};">
${factRows(opts.facts)}
</table>`
		: '';
	const cta = opts.cta
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr><td>
<a href="${escapeHtml(opts.cta.url)}" style="display:block;text-align:center;background:${INK};color:${GROUND};font-family:${BODY_STACK};font-size:17px;font-weight:bold;text-decoration:none;padding:16px 32px;border-radius:999px;">${escapeHtml(opts.cta.label)}</a>
</td></tr></table>`
		: '';
	const footer = opts.footer
		? `<p style="margin:28px 0 0;padding-top:14px;border-top:${HAIRLINE};font-family:${BODY_STACK};font-size:13px;line-height:1.5;color:${INK_45};">${linkify(escapeHtml(opts.footer))}</p>`
		: '';

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<style>
@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@700&family=Hanken+Grotesk:wght@400;500;700&display=swap');
@media (max-width:480px){ .heading{font-size:40px !important;} .pad{padding-left:20px !important;padding-right:20px !important;} }
</style>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${GROUND}" style="background:${GROUND};">
<tr><td align="center" class="pad" style="padding:44px 28px 52px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="font-family:${BODY_STACK};font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:${INK};padding-bottom:20px;">The Atmospheric Builders&#8217; Retreat</td></tr>
<tr><td class="heading" style="font-family:${DISPLAY_STACK};font-size:52px;font-weight:bold;line-height:0.95;letter-spacing:0.5px;text-transform:uppercase;color:${INK};padding-bottom:4px;">${escapeHtml(opts.heading)}</td></tr>
<tr><td>${facts}</td></tr>
<tr><td style="padding-top:28px;">
${paragraphs(opts.body)}
${cta}
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function retreatFacts(): EmailFact[] {
	return [
		{ label: 'When', value: retreatDates.display },
		{ label: 'Where', value: retreatLocation.display }
	];
}

/** Standard wrapper for organizer broadcasts: subject as headline, retreat ledger, home CTA. */
export function broadcastHtml(subject: string, body: string): string {
	return brandedEmail({
		heading: subject,
		body,
		facts: retreatFacts(),
		cta: { label: 'buildersretre.at', url: 'https://buildersretre.at' },
		footer: 'You’re getting this because you’re on the Builders’ Retreat list. Reply any time — it goes straight to Bryan.'
	});
}
