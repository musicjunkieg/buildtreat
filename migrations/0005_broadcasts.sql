-- the Atmospheric Builders' Retreat — organizer email broadcasts

-- One row per composed announcement. Recipients are snapshotted at send
-- time (deduped by lowercased email, sourced from survey responses); the
-- recipient rows double as audit trail, double-send guard, and retry
-- worklist. Spec: docs/superpowers/specs/2026-08-17-comail-email-sending-design.md.
CREATE TABLE IF NOT EXISTS broadcasts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	subject TEXT NOT NULL,
	body TEXT NOT NULL,
	sent_by TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
	broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id),
	did TEXT NOT NULL,
	email TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	error_code TEXT,
	message_id TEXT,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (broadcast_id, did)
);
