-- the Atmospheric Builders' Retreat — waitlist for uninvited-but-interested

-- Signed-in visitors who aren't on the allowlist can add themselves here.
-- Promotion (organizer side) inserts their handle into `allowlist` and stamps
-- promoted_at; the existing survey gate then admits them. One row per DID
-- (re-signing-in upserts), so joining is idempotent.
CREATE TABLE IF NOT EXISTS waitlist (
	did TEXT PRIMARY KEY,
	handle TEXT,
	email TEXT NOT NULL,
	created_at TEXT NOT NULL,
	promoted_at TEXT
);
