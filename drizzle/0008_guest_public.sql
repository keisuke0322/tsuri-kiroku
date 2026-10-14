ALTER TABLE catches ADD COLUMN guest_public INTEGER NOT NULL DEFAULT 0 CHECK (guest_public IN (0,1));
CREATE INDEX idx_catches_guest_date ON catches(guest_public,date);
