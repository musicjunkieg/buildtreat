-- the Atmospheric Builders' Retreat — broadcast audience

-- Which list a broadcast went to: 'all' (every survey respondent, the only
-- option before this column existed), 'yes' / 'maybe' / 'no' (respondents by
-- survey interest), or 'waitlist' (un-promoted waitlist entries). Recipients
-- are still snapshotted per broadcast; this only labels the history.
ALTER TABLE broadcasts ADD COLUMN audience TEXT NOT NULL DEFAULT 'all';
