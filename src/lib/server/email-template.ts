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
	/**
	 * Light markdown: blank lines split paragraphs, single newlines become
	 * <br>, `##` headings, `- ` / `1. ` lists, `**bold**`, `_italic_`, links.
	 */
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

const URL_RE = /https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*/g;
const LABELED_LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g;

function anchor(href: string, label: string): string {
	return `<a href="${href}" style="color:${INK};text-decoration:underline;">${label}</a>`;
}

/**
 * Sentence punctuation right after a bare URL belongs to the sentence. A
 * closing paren is only trimmed when it doesn't balance one inside the URL,
 * so `https://…/Foo_(bar)` survives intact.
 */
function trimUrl(match: string): string {
	let url = match;
	for (;;) {
		const last = url.at(-1) ?? '';
		if (last === ')') {
			const open = url.split('(').length - 1;
			const close = url.split(')').length - 1;
			if (close <= open) break;
		} else if (!'.,;:!?'.includes(last)) {
			break;
		}
		url = url.slice(0, -1);
	}
	return url;
}

function emphasis(escaped: string): string {
	return escaped
		.replace(/\*\*([^*\n]+)\*\*/g, `<strong style="color:${INK};">$1</strong>`)
		.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/g, '$1<em>$2</em>');
}

/**
 * Minimal inline markup for organizer-written bodies, applied to already-
 * escaped text: `[label](https://…)` → link, bare http(s) URLs → link,
 * `**bold**`, `_italic_`. Links are lifted out first and restored last, so
 * emphasis markers never rewrite the inside of an href; only http(s) hrefs
 * are honoured, anything else stays literal.
 */
function inlineMarkup(escaped: string): string {
	const held: string[] = [];
	const hold = (html: string) => `\uE000${held.push(html) - 1}\uE000`;
	const withLinks = escaped
		.replace(LABELED_LINK_RE, (_, label: string, url: string) => hold(anchor(url, emphasis(label))))
		.replace(URL_RE, (match) => {
			const url = trimUrl(match);
			return hold(anchor(url, url)) + match.slice(url.length);
		});
	return emphasis(withLinks).replace(/\uE000(\d+)\uE000/g, (_, i: string) => held[Number(i)]);
}

const HEADING_RE = /^(#{1,3})(?:\s+|(?=[A-Za-z]))(.+)$/;
const BULLET_RE = /^[-*•]\s+/;
const NUMBER_RE = /^\d+[.)]\s+/;

const P_STYLE = `margin:0 0 16px;font-family:${BODY_STACK};font-size:16px;line-height:1.55;color:${INK_70};`;
const H2_STYLE = `margin:28px 0 12px;font-family:${DISPLAY_STACK};font-size:26px;font-weight:bold;line-height:1.05;letter-spacing:0.5px;text-transform:uppercase;color:${INK};`;
const H3_STYLE = `margin:24px 0 10px;font-family:${BODY_STACK};font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${INK};`;

function inline(text: string): string {
	return inlineMarkup(escapeHtml(text));
}

function heading(level: number, text: string): string {
	return level < 3 ? `<h2 style="${H2_STYLE}">${inline(text)}</h2>` : `<h3 style="${H3_STYLE}">${inline(text)}</h3>`;
}

function paragraph(lines: string[]): string {
	return `<p style="${P_STYLE}">${lines.map(inline).join('<br>')}</p>`;
}

/**
 * A run of lines whose first line carries a list marker. Marker lines start
 * items; unmarked lines continue the current item as soft breaks.
 */
function list(lines: string[], marker: RegExp, tag: 'ul' | 'ol'): string {
	const items: string[][] = [];
	for (const line of lines) {
		if (marker.test(line)) items.push([line.replace(marker, '')]);
		else items.at(-1)?.push(line);
	}
	const li = items
		.map((item) => `<li style="margin:0 0 6px;">${item.map(inline).join('<br>')}</li>`)
		.join('\n');
	return `<${tag} style="${P_STYLE}padding-left:24px;">\n${li}\n</${tag}>`;
}

function block(lines: string[]): string {
	const [first] = lines;
	if (BULLET_RE.test(first)) return list(lines, BULLET_RE, 'ul');
	if (NUMBER_RE.test(first)) return list(lines, NUMBER_RE, 'ol');
	return paragraph(lines);
}

/**
 * Block structure for organizer-written bodies: blank lines separate
 * blocks; a line opening with `#`–`###` is a heading on its own; a block
 * opening with `- `, `* `, `• ` or `1. ` is a list; anything else is a
 * paragraph with single newlines as soft breaks.
 */
function paragraphs(body: string): string {
	const out: string[] = [];
	let run: string[] = [];
	const flush = () => {
		if (run.length) out.push(block(run));
		run = [];
	};
	for (const raw of body.split('\n')) {
		const line = raw.trim();
		const h = HEADING_RE.exec(line);
		if (!line) {
			flush();
		} else if (h) {
			flush();
			out.push(heading(h[1].length, h[2].trim()));
		} else {
			run.push(line);
		}
	}
	flush();
	return out.join('\n');
}

/** Body text with block markers dropped, for the preheader. */
export function stripMarkup(body: string): string {
	return body
		.split('\n')
		.map((line) => line.trim().replace(HEADING_RE, '$2').replace(BULLET_RE, '').replace(NUMBER_RE, ''))
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
	// Fluid cells (percentage widths) so narrow clients shrink the row with
	// the column; the pixel width survives only as the image's max-width.
	const pct = (100 / images.length).toFixed(2);
	const maxWidth = Math.floor((600 - (images.length - 1) * 12) / images.length);
	const cells = images
		.map(
			(img, i) => `<td width="${pct}%" valign="top" style="width:${pct}%;padding-left:${i === 0 ? 0 : 12}px;">
<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" style="display:block;width:100%;max-width:${maxWidth}px;height:auto;color:${INK_70};font-family:${BODY_STACK};font-size:13px;">
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
	const preheader = stripMarkup(opts.body).replace(/\s+/g, ' ').trim().slice(0, 120);
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
		? `<p style="margin:28px 0 0;padding-top:14px;border-top:${HAIRLINE};font-family:${BODY_STACK};font-size:13px;line-height:1.5;color:${INK_45};">${inlineMarkup(escapeHtml(opts.footer))}</p>`
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

/**
 * Where we're staying. One full-width shot of the east valley — Bermuda Dunes itself has no usable
 * open-licensed photography, so this is the La Quinta Resort a few miles down Highway 111, same
 * Santa Rosa mountains, same light — and the caption says so, so nobody mistakes it for the house.
 * Email audiences only; the public site stays at "Palm Springs".
 */
export function locationImages(): EmailImage[] {
	return [
		{
			src: 'https://buildersretre.at/media/email-loc-bermuda-dunes.jpg',
			alt: 'Spanish-style villas, palms and a pool at sunrise below the Santa Rosa Mountains in the east Coachella Valley',
			label: 'La Quinta, a few miles from the house'
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
