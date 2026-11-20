-- Composite outputs replaced the original single-overlay docks in migration
-- 0002. The old rows are no longer read by the Worker and can otherwise keep
-- deleted variants alive through their legacy foreign keys.
DELETE FROM docks;
