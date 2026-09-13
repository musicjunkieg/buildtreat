import { describe, expect, it } from 'vitest';
import { brandedEmail, broadcastHtml, escapeHtml, heroImage, locationImages, retreatFacts } from './email-template';

describe('escapeHtml', () => {
	it('escapes the five html-significant characters', () => {
		expect(escapeHtml(`<b>"Tom & Jerry's"</b>`)).toBe('&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;');
	});
});

describe('brandedEmail', () => {
	it('renders heading, paragraphs, facts, cta, and footer', () => {
		const html = brandedEmail({
			heading: 'The date is set',
			body: 'First paragraph.\n\nSecond paragraph\nwith a soft break.',
			facts: [{ label: 'When', value: 'December 4–7, 2026' }],
			cta: { label: 'Register now', url: 'https://buildersretre.at' },
			footer: 'Reply any time.'
		});
		expect(html).toContain('The date is set');
		expect(html).toContain('First paragraph.');
		expect(html).toContain('Second paragraph<br>with a soft break.');
		expect(html).toContain('December 4–7, 2026');
		expect(html).toContain('href="https://buildersretre.at"');
		expect(html).toContain('Register now');
		expect(html).toContain('Reply any time.');
	});

	it('escapes user content everywhere it lands', () => {
		const html = brandedEmail({
			heading: '<script>alert(1)</script>',
			body: 'Hello <img src=x onerror=alert(1)>',
			facts: [{ label: '<i>When</i>', value: '"soon" & later' }],
			cta: { label: '<b>Go</b>', url: 'https://x.test/?a=1&b=2' },
			footer: '<u>bye</u>'
		});
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('<i>When</i>');
		expect(html).not.toContain('<b>Go</b>');
		expect(html).not.toContain('<u>bye</u>');
		expect(html).toContain('href="https://x.test/?a=1&amp;b=2"');
	});

	it('linkifies bare urls in body text', () => {
		const html = brandedEmail({ heading: 'H', body: 'Go to https://buildersretre.at today.' });
		expect(html).toContain('<a href="https://buildersretre.at"');
	});

	it('renders bold, italic, and bracketed links in body text', () => {
		const html = brandedEmail({
			heading: 'H',
			body: 'Please **read this** and _reply_ via [the site](https://buildersretre.at/?x=1&y=2) or https://example.com.'
		});
		expect(html).toContain('<strong style="color:#ffffff;">read this</strong>');
		expect(html).toContain('<em>reply</em>');
		expect(html).toContain('<a href="https://buildersretre.at/?x=1&amp;y=2" style="color:#ffffff;text-decoration:underline;">the site</a>');
		expect(html).toContain('<a href="https://example.com"');
		// The bracketed URL must not be linkified a second time inside its own anchor.
		expect(html.match(/<a /g)).toHaveLength(2);
	});

	it('leaves non-http links, snake_case words, and stray asterisks literal', () => {
		const html = brandedEmail({ heading: 'H', body: '[bad](javascript:alert(1)) my_var_name 5 * 3 ** 2' });
		expect(html).not.toContain('<a ');
		expect(html).toContain('my_var_name');
		expect(html).not.toContain('<strong');
		expect(html).not.toContain('<em>');
	});

	it('keeps balanced parentheses inside urls and emphasis markers out of hrefs', () => {
		const html = brandedEmail({
			heading: 'H',
			body: 'See https://en.wikipedia.org/wiki/Foo_(bar). Or [wiki](https://en.wikipedia.org/wiki/Foo_(bar)) and [docs](https://example.test/**v2**/_x_) or https://example.test/**v3**.'
		});
		expect(html).toContain('<a href="https://en.wikipedia.org/wiki/Foo_(bar)" style="color:#ffffff;text-decoration:underline;">https://en.wikipedia.org/wiki/Foo_(bar)</a>.');
		expect(html).toContain('>wiki</a>');
		expect(html).toContain('<a href="https://example.test/**v2**/_x_"');
		expect(html).toContain('<a href="https://example.test/**v3**"');
		expect(html).not.toContain('<strong');
		expect(html).not.toContain('<em>');
	});

	it('still trims an unbalanced trailing paren after a bare url', () => {
		const html = brandedEmail({ heading: 'H', body: '(see https://example.test/a)' });
		expect(html).toContain('<a href="https://example.test/a" style="color:#ffffff;text-decoration:underline;">https://example.test/a</a>)');
	});

	it('puts the opening body text in the hidden preheader', () => {
		const html = brandedEmail({ heading: 'H', body: 'This is the preview line.\n\nMore below.' });
		expect(html).toContain('This is the preview line.');
		expect(html.indexOf('This is the preview line.')).toBeLessThan(html.indexOf('More below.'));
	});

	it('omits facts, cta, and footer blocks when not provided', () => {
		const html = brandedEmail({ heading: 'H', body: 'Just words.' });
		expect(html).not.toContain('border-radius:999px');
		expect(html).not.toContain('letter-spacing:1.5px');
	});
});

describe('images', () => {
	it('renders a labeled side-by-side photo row with alt text', () => {
		const html = brandedEmail({ heading: 'H', body: 'B', images: locationImages() });
		expect(html).toContain('https://buildersretre.at/media/email-loc-palm-springs.jpg');
		expect(html).toContain('https://buildersretre.at/media/email-loc-coachella-valley.jpg');
		expect(html).toContain('alt="Palm Springs city lights at dusk from the Aerial Tramway"');
		expect(html).toContain('>Palm Springs</div>');
		expect(html).toContain('>Coachella Valley</div>');
	});

	it('uses fluid percentage cells so narrow clients shrink the row', () => {
		const html = brandedEmail({ heading: 'H', body: 'B', images: locationImages() });
		expect(html).toContain('width="50.00%"');
		expect(html).toContain('width:50.00%');
		expect(html).toContain('max-width:294px');
		expect(html).not.toMatch(/<td width="\d+"/);
		expect(html).not.toMatch(/<img[^>]*width="\d+"/);
	});
});

describe('hero', () => {
	it('sets the headline over the hero background with a ground-color fallback', () => {
		const html = brandedEmail({ heading: 'The date is set', body: 'B', hero: heroImage() });
		expect(html).toContain('background="https://buildersretre.at/media/email-hero.jpg"');
		expect(html).toContain('bgcolor="#0b0908"');
		expect(html).toContain('center bottom / cover');
		expect(html).toContain('The date is set');
	});

	it('renders the plain header without a hero', () => {
		const html = brandedEmail({ heading: 'H', body: 'B' });
		expect(html).not.toContain('email-hero.jpg');
	});
});

describe('broadcastHtml', () => {
	it('wraps the subject as headline with hero, retreat facts, and home cta', () => {
		const html = broadcastHtml('See you in the desert', 'Details inside.');
		expect(html).toContain('See you in the desert');
		expect(html).toContain('email-hero.jpg');
		expect(html).toContain('December 4–7, 2026');
		expect(html).toContain('Palm Springs or Coachella Valley');
		expect(html).toContain('href="https://buildersretre.at"');
	});
});

describe('retreatFacts', () => {
	it('carries the locked dates and honest venue line', () => {
		const facts = retreatFacts();
		expect(facts.map((f) => f.label)).toEqual(['When', 'Where']);
		expect(facts[1].value).toContain('Palm Springs');
	});
});
