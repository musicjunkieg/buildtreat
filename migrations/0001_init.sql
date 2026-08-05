-- the Atmospheric Builders' Retreat — survey schema

CREATE TABLE IF NOT EXISTS responses (
	did TEXT PRIMARY KEY,
	handle TEXT,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	home_location TEXT NOT NULL,
	interest TEXT NOT NULL CHECK (interest IN ('yes', 'no', 'maybe')),
	travel TEXT CHECK (travel IN ('yes', 'partial', 'no')),
	location_ranking TEXT NOT NULL DEFAULT '[]',
	submitted_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_ranges (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	did TEXT NOT NULL REFERENCES responses(did) ON DELETE CASCADE,
	start_date TEXT NOT NULL,
	end_date TEXT NOT NULL,
	start_portion TEXT NOT NULL DEFAULT 'full' CHECK (start_portion IN ('full', 'first_half', 'second_half')),
	end_portion TEXT NOT NULL DEFAULT 'full' CHECK (end_portion IN ('full', 'first_half', 'second_half'))
);

CREATE INDEX IF NOT EXISTS idx_ranges_did ON availability_ranges(did);

-- Empty allowlist = everyone with the link may respond (pre-launch state).
-- Populate with invited handles to enforce invite-only access.
CREATE TABLE IF NOT EXISTS allowlist (
	handle TEXT PRIMARY KEY,
	did TEXT
);
