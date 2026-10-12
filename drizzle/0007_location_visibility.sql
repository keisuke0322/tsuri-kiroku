-- Preserve existing public place names without publishing stored coordinates.
ALTER TABLE catches ADD COLUMN location_visibility TEXT NOT NULL DEFAULT 'area' CHECK(location_visibility IN ('area','exact','private'));
ALTER TABLE catches ADD COLUMN public_latitude REAL CHECK(public_latitude BETWEEN -90 AND 90);
ALTER TABLE catches ADD COLUMN public_longitude REAL CHECK(public_longitude BETWEEN -180 AND 180);
