-- the Atmospheric Builders' Retreat — persistent scenario anchors
-- The organizer's flagged people. Global (shared by all organizers): one
-- planning view, not per-user scenarios. Rows always refer to respondents
-- (the toggle only exists on the responses table); un-anchoring deletes.
CREATE TABLE IF NOT EXISTS anchors (
	did TEXT PRIMARY KEY,
	created_at TEXT NOT NULL
);
