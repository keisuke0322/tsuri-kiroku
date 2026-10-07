-- The ledger counts stored objects AND in-flight reservations. No cascading deletes:
-- a row must survive until its R2 object has definitely been removed.
ALTER TABLE catches ADD COLUMN photos_deleting integer NOT NULL DEFAULT 0;
CREATE TABLE photo_storage_settings (
 id integer PRIMARY KEY CONSTRAINT photo_settings_singleton CHECK (id = 1),
 initialized integer NOT NULL DEFAULT 0,
 maintenance integer NOT NULL DEFAULT 0,
 inventory_cursor text,
 used_bytes integer NOT NULL DEFAULT 0 CONSTRAINT photo_settings_used CHECK (used_bytes >= 0),
 global_limit_bytes integer NOT NULL DEFAULT 8000000000 CONSTRAINT photo_settings_global CHECK (global_limit_bytes >= 0),
 user_limit_bytes integer NOT NULL DEFAULT 100000000 CONSTRAINT photo_settings_user CHECK (user_limit_bytes >= 0)
);
INSERT INTO photo_storage_settings (id) VALUES (1);
CREATE TABLE photo_storage_users (
 owner_id text PRIMARY KEY,
 used_bytes integer NOT NULL DEFAULT 0 CONSTRAINT photo_user_used CHECK (used_bytes >= 0)
);
CREATE TABLE photo_storage_objects (
 object_key text PRIMARY KEY,
 owner_id text,
 catch_id integer,
 byte_size integer NOT NULL CONSTRAINT photo_object_size CHECK (byte_size >= 0),
 state text NOT NULL CONSTRAINT photo_object_state CHECK (state IN ('reserved','stored','deleting')),
 inventory_seen integer NOT NULL DEFAULT 0,
 created_at text NOT NULL
);
CREATE INDEX idx_photo_storage_owner ON photo_storage_objects(owner_id);
CREATE INDEX idx_photo_storage_catch ON photo_storage_objects(catch_id);
CREATE INDEX idx_photo_storage_state ON photo_storage_objects(state);
CREATE TRIGGER photo_storage_charge AFTER INSERT ON photo_storage_objects BEGIN
 UPDATE photo_storage_settings SET used_bytes=used_bytes+NEW.byte_size WHERE id=1;
 INSERT INTO photo_storage_users (owner_id,used_bytes) SELECT NEW.owner_id,NEW.byte_size WHERE NEW.owner_id IS NOT NULL
 ON CONFLICT(owner_id) DO UPDATE SET used_bytes=used_bytes+NEW.byte_size;
 END;
CREATE TRIGGER photo_storage_release AFTER DELETE ON photo_storage_objects BEGIN
 UPDATE photo_storage_settings SET used_bytes=used_bytes-OLD.byte_size WHERE id=1;
 UPDATE photo_storage_users SET used_bytes=used_bytes-OLD.byte_size WHERE owner_id=OLD.owner_id;
 END;
CREATE TRIGGER photo_storage_resize AFTER UPDATE OF byte_size ON photo_storage_objects BEGIN
 UPDATE photo_storage_settings SET used_bytes=used_bytes+NEW.byte_size-OLD.byte_size WHERE id=1;
 UPDATE photo_storage_users SET used_bytes=used_bytes+NEW.byte_size-OLD.byte_size WHERE owner_id=OLD.owner_id;
 END;
-- Conservative placeholders allow deletion before the first inventory finishes.
INSERT INTO photo_storage_objects (object_key,owner_id,catch_id,byte_size,state,created_at)
 SELECT p.object_key,c.owner_id,p.catch_id,8388608,'stored',p.created_at
 FROM catch_photos p JOIN catches c ON c.id=p.catch_id GROUP BY p.object_key;
CREATE TRIGGER photo_storage_reserve BEFORE INSERT ON photo_storage_objects
 WHEN NEW.state='reserved'
 BEGIN
 SELECT CASE WHEN (SELECT initialized FROM photo_storage_settings WHERE id=1) != 1 OR (SELECT maintenance FROM photo_storage_settings WHERE id=1) != 0
 THEN RAISE(ABORT,'photo_storage_not_ready') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM catches WHERE id=NEW.catch_id AND owner_id=NEW.owner_id AND photos_deleting=0)
 THEN RAISE(ABORT,'photo_catch_unavailable') END;
 SELECT CASE WHEN (SELECT used_bytes FROM photo_storage_settings WHERE id=1)+NEW.byte_size >
 (SELECT global_limit_bytes FROM photo_storage_settings WHERE id=1)
 THEN RAISE(ABORT,'photo_global_limit') END;
 SELECT CASE WHEN (SELECT COALESCE((SELECT used_bytes FROM photo_storage_users WHERE owner_id=NEW.owner_id),0))+NEW.byte_size >
 (SELECT user_limit_bytes FROM photo_storage_settings WHERE id=1)
 THEN RAISE(ABORT,'photo_user_limit') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM catch_photos WHERE catch_id=NEW.catch_id)+
 (SELECT COUNT(*) FROM photo_storage_objects WHERE catch_id=NEW.catch_id AND state='reserved') >= 6
 THEN RAISE(ABORT,'photo_count_limit') END;
 END;
CREATE TRIGGER photo_storage_attach BEFORE INSERT ON catch_photos
 BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM photo_storage_objects s JOIN catches c ON c.id=s.catch_id
 WHERE s.object_key=NEW.object_key AND s.catch_id=NEW.catch_id AND s.state='reserved' AND c.photos_deleting=0)
 THEN RAISE(ABORT,'photo_catch_unavailable') END;
 END;
