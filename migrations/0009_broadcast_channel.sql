-- the Atmospheric Builders' Retreat — broadcast channel

-- Broadcasts can now go out as Bluesky DMs as well as email. `channel` says
-- which transport a broadcast used ('email', the only option before this
-- column, or 'dm'). DM recipient rows are keyed by DID like email rows but
-- carry an empty email and the handle at send time, so the history can
-- show who was messaged without a profile lookup.
ALTER TABLE broadcasts ADD COLUMN channel TEXT NOT NULL DEFAULT 'email';
ALTER TABLE broadcast_recipients ADD COLUMN handle TEXT;
