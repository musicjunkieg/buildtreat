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

export interface EmailImage {
	src: string;
	alt: string;
	label?: string;
}

export interface BrandedEmailOptions {
	/** Display headline, rendered stacked and uppercase. */
	heading: string;
	/** Plain text; blank lines split paragraphs, single newlines become <br>. */
	body: string;
	/**
	 * Dusk photograph behind the kicker + headline, pre-scrimmed so its
	 * bottom edge fades to the ground color. Blocked-image clients fall
	 * back to the flat ground via bgcolor; text stays live HTML.
	 */
	hero?: { src: string };
	/** Hairline ledger rows shown under the headline. */
	facts?: EmailFact[];
	/** Photo row under the ledger — side by side, labeled in fact style. */
	images?: EmailImage[];
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

function imageRow(images: EmailImage[]): string {
	const width = Math.floor((600 - (images.length - 1) * 12) / images.length);
	const cells = images
		.map(
			(img, i) => `<td width="${width}" valign="top" style="padding-left:${i === 0 ? 0 : 12}px;">
<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" width="${width}" style="display:block;width:100%;height:auto;color:${INK_70};font-family:${BODY_STACK};font-size:13px;">
${img.label ? `<div style="padding-top:8px;font-family:${BODY_STACK};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${INK_70};">${escapeHtml(img.label)}</div>` : ''}
</td>`
		)
		.join('\n');
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr>
${cells}
</tr></table>`;
}

const KICKER_TD = `style="font-family:${BODY_STACK};font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:${INK};padding-bottom:20px;"`;
const HEADING_TD = `class="heading" style="font-family:${DISPLAY_STACK};font-size:52px;font-weight:bold;line-height:0.95;letter-spacing:0.5px;text-transform:uppercase;color:${INK};padding-bottom:4px;"`;
const KICKER_TEXT = 'The Atmospheric Builders&#8217; Retreat';

/**
 * Kicker + headline, optionally set over a pre-scrimmed hero photograph.
 * The hero image's baked fade ends at the ground color, and center-bottom /
 * cover positioning pins that faded edge to the cell's bottom, so the block
 * hands off seamlessly to the flat ground below. No Outlook VML fill: the
 * Word engine ignores background-image and shows the bgcolor ground, which
 * is the intended degraded state.
 */
function header(opts: BrandedEmailOptions): string {
	if (!opts.hero) {
		return `<tr><td ${KICKER_TD}>${KICKER_TEXT}</td></tr>
<tr><td ${HEADING_TD}>${escapeHtml(opts.heading)}</td></tr>`;
	}
	const src = escapeHtml(opts.hero.src);
	return `<tr><td background="${src}" bgcolor="${GROUND}" style="background:${GROUND} url('${src}') center bottom / cover no-repeat;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:230px 0 0;"></td></tr>
<tr><td ${KICKER_TD}>${KICKER_TEXT}</td></tr>
<tr><td ${HEADING_TD}>${escapeHtml(opts.heading)}</td></tr>
</table>
</td></tr>`;
}

export function brandedEmail(opts: BrandedEmailOptions): string {
	const preheader = opts.body.replace(/\s+/g, ' ').trim().slice(0, 120);
	const facts = opts.facts?.length
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-bottom:${HAIRLINE};">
${factRows(opts.facts)}
</table>`
		: '';
	const images = opts.images?.length ? imageRow(opts.images) : '';
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
${header(opts)}
<tr><td>${facts}${images}</td></tr>
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

/** Pre-scrimmed dusk hero derived from the site's hero-landscape photography. */
export function heroImage(): { src: string } {
	return { src: 'https://buildersretre.at/media/email-hero.jpg' };
}

/** The two venue contenders — swap for the booked house once the venue locks. */
export function locationImages(): EmailImage[] {
	return [
		{
			src: 'https://buildersretre.at/media/email-loc-palm-springs.jpg',
			alt: 'Palm Springs city lights at dusk from the Aerial Tramway',
			label: 'Palm Springs'
		},
		{
			src: 'https://buildersretre.at/media/email-loc-coachella-valley.jpg',
			alt: 'Palm oasis in the Coachella Valley Preserve',
			label: 'Coachella Valley'
		}
	];
}

/** Standard wrapper for organizer broadcasts: subject as headline, retreat ledger, home CTA. */
export function broadcastHtml(subject: string, body: string): string {
	return brandedEmail({
		heading: subject,
		body,
		hero: heroImage(),
		facts: retreatFacts(),
		images: locationImages(),
		cta: { label: 'buildersretre.at', url: 'https://buildersretre.at' },
		footer: 'You’re getting this because you’re on the Builders’ Retreat list. Reply any time — it goes straight to Bryan.'
	});
}
