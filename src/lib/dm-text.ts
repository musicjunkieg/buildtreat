/**
 * Length rules for Bluesky DMs, shared by the compose form's live counter
 * and the server-side check — chat.bsky.convo.sendMessage caps message text
 * at 1000 graphemes, and both sides need to count the same way.
 */
export const DM_MAX_GRAPHEMES = 1000;

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** User-perceived character count, matching how the chat service enforces its cap. */
export function graphemeCount(text: string): number {
	if (!segmenter) return [...text].length;
	return [...segmenter.segment(text)].length;
}
