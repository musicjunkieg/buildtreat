import { describe, expect, it } from 'vitest';
import { dedupeRecipients } from './broadcasts';

describe('dedupeRecipients', () => {
	it('drops later rows whose email matches case-insensitively, keeping the first', () => {
		const out = dedupeRecipients([
			{ did: 'did:plc:a', email: 'One@Example.com' },
			{ did: 'did:plc:b', email: 'one@example.com' },
			{ did: 'did:plc:c', email: 'two@example.com' }
		]);
		expect(out).toEqual([
			{ did: 'did:plc:a', email: 'One@Example.com' },
			{ did: 'did:plc:c', email: 'two@example.com' }
		]);
	});

	it('skips rows with empty emails', () => {
		expect(dedupeRecipients([{ did: 'did:plc:a', email: '  ' }])).toEqual([]);
	});
});
