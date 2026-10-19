CREATE TABLE gear (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('ロッド','リール','ライン','リーダー','ルアー','仕掛け','その他')),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 manufacturer TEXT NOT NULL DEFAULT '' CHECK(length(manufacturer)<=120),
 model TEXT NOT NULL DEFAULT '' CHECK(length(model)<=120),
 spec TEXT NOT NULL DEFAULT '' CHECK(length(spec)<=300),
 memo TEXT NOT NULL DEFAULT '' CHECK(length(memo)<=2000),
 favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
 retired INTEGER NOT NULL DEFAULT 0 CHECK(retired IN (0,1))
);
CREATE INDEX idx_gear_owner ON gear(owner_id);
CREATE TABLE gear_sets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 target_species TEXT NOT NULL DEFAULT '' CHECK(length(target_species)<=80),
 method TEXT NOT NULL DEFAULT '' CHECK(length(method)<=200),
 gear_json TEXT NOT NULL CHECK(json_valid(gear_json)),
 favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
 retired INTEGER NOT NULL DEFAULT 0 CHECK(retired IN (0,1))
);
CREATE INDEX idx_gear_sets_owner ON gear_sets(owner_id);
CREATE TABLE catch_combinations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 catch_id INTEGER NOT NULL REFERENCES catches(id) ON DELETE CASCADE,
 set_id INTEGER REFERENCES gear_sets(id),
 set_name TEXT NOT NULL DEFAULT '',
 method TEXT NOT NULL DEFAULT '',
 gear_json TEXT NOT NULL CHECK(json_valid(gear_json)),
 species_json TEXT NOT NULL CHECK(json_valid(species_json)),
 signature TEXT NOT NULL,
 sort_order INTEGER NOT NULL
);
CREATE INDEX idx_combinations_catch ON catch_combinations(catch_id,sort_order);
CREATE INDEX idx_combinations_set ON catch_combinations(set_id,catch_id);
CREATE INDEX idx_combinations_signature ON catch_combinations(signature,catch_id);
