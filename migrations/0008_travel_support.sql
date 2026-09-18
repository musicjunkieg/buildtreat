-- Travel support: how much assistance an attendee needs and whether their
-- attendance hinges on it. Asked at registration of everyone whose survey
-- travel answer wasn't "yes" (partial / no / never answered), so the
-- organizer can take a concrete number to Bluesky.
--   support_need        'none' | 'partial' | 'full'  (NULL = not asked / unanswered)
--   support_amount      whole US dollars requested   (NULL unless need is partial/full)
--   support_contingent  1 = can't attend without it   (NULL unless need is partial/full)
ALTER TABLE registrations ADD COLUMN support_need TEXT;
ALTER TABLE registrations ADD COLUMN support_amount INTEGER;
ALTER TABLE registrations ADD COLUMN support_contingent INTEGER;
