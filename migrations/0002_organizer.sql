-- the Atmospheric Builders' Retreat — organizer backend

-- Key/value switches the organizer can flip without a redeploy.
-- 'reopen' = '1' overrides a passed DEADLINE for everyone.
CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- Per-respondent late passes: the deadline stays closed, but these handles
-- may still submit/edit. Same handle-or-DID matching policy as the allowlist
-- (DID pinned on first authenticated use so handle changes don't revoke).
CREATE TABLE IF NOT EXISTS late_passes (
	handle TEXT PRIMARY KEY,
	did TEXT,
	granted_at TEXT NOT NULL
);
