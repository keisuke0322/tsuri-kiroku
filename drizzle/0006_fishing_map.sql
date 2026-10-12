CREATE TABLE fishing_spots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1))
);
CREATE INDEX idx_fishing_spots_owner ON fishing_spots(owner_id);
CREATE TABLE catch_positions (
 catch_id INTEGER PRIMARY KEY REFERENCES catches(id) ON DELETE CASCADE,
 spot_id INTEGER REFERENCES fishing_spots(id) ON DELETE SET NULL,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 source TEXT NOT NULL CHECK(source IN ('gps','map','saved'))
);
