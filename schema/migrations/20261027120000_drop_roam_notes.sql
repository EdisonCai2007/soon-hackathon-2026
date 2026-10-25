-- Takes ROAM's notes out (app/worker/apps/roam/): the notes left in the scanned home, their photos and clips,
-- and each place's keeper go. IF EXISTS, so a database that never made the tables runs it too.
DROP TABLE IF EXISTS roam_notes;
DROP TABLE IF EXISTS roam_places;
