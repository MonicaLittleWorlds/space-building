CREATE TABLE IF NOT EXISTS builder_code (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, digest TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS owner_sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, master TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS owner_sessions_expiry ON owner_sessions(expires);
CREATE TABLE IF NOT EXISTS access_limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(key,bucket));
CREATE INDEX IF NOT EXISTS access_limits_bucket ON access_limits(bucket);
