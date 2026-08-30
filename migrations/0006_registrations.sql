-- the Atmospheric Builders' Retreat — registration for the locked Dec 4–7 dates

-- One row per DID, upserted. 'confirmed' + agreed_at set = a complete
-- registration (derived, never stored). 'declined' rows are minimal.
-- Travel columns stay editable after the registration deadline.
-- Spec: docs/superpowers/specs/2026-08-25-registration-design.md.
CREATE TABLE IF NOT EXISTS registrations (
	did TEXT PRIMARY KEY,
	handle TEXT,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	status TEXT NOT NULL,
	phone TEXT,
	emergency_name TEXT,
	emergency_phone TEXT,
	dietary TEXT,
	dietary_other TEXT,
	accessibility TEXT,
	notes TEXT,
	travel_arrival TEXT,
	travel_departure TEXT,
	travel_mode TEXT,
	travel_details TEXT,
	waiver_version TEXT,
	coc_version TEXT,
	agreed_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
