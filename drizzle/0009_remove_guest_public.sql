-- Apply only after deploying the login-required Worker; keep the applied 0008 history.
DROP INDEX idx_catches_guest_date;
ALTER TABLE catches DROP COLUMN guest_public;
