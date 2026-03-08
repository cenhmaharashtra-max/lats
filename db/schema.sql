-- LATS Database Schema (PostgreSQL)
-- Auto-runs on server start

CREATE TABLE IF NOT EXISTS lats_users (
  id        SERIAL PRIMARY KEY,
  username  VARCHAR(100) UNIQUE NOT NULL,
  password  VARCHAR(255) NOT NULL,
  name      VARCHAR(200) NOT NULL,
  role      VARCHAR(20)  DEFAULT 'viewer'
);

CREATE TABLE IF NOT EXISTS lats_projects (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(300) NOT NULL,
  tafs_no       VARCHAR(100),
  length        NUMERIC(12,4),
  tpc           NUMERIC(15,2),
  civil_cost    NUMERIC(15,2),
  la_cost       NUMERIC(15,2),
  total_land    NUMERIC(12,4),
  avail_land    NUMERIC(12,4),
  la_required   NUMERIC(12,4),
  la_length     NUMERIC(12,4),
  la_length_tafs NUMERIC(12,4),
  approval_date VARCHAR(20),
  assigned_users INTEGER[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS lats_villages (
  id         SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES lats_projects(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  taluka     VARCHAR(200),
  is_addl    BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lats_p3a (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER REFERENCES lats_projects(id) ON DELETE CASCADE,
  village_id   INTEGER REFERENCES lats_villages(id) ON DELETE CASCADE,
  ptype        VARCHAR(10) NOT NULL,
  notif_date   VARCHAR(20),
  cala_post    VARCHAR(300),
  cala_name    VARCHAR(300),
  cala_mobile  VARCHAR(30),
  la_length_3a NUMERIC(12,4),
  is_addl      BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lats_p3a_guts (
  id          SERIAL PRIMARY KEY,
  p3a_id      INTEGER REFERENCES lats_p3a(id) ON DELETE CASCADE,
  gut_number  VARCHAR(50),
  area        NUMERIC(12,4),
  land_type   VARCHAR(50) DEFAULT 'Private Land'
);

CREATE TABLE IF NOT EXISTS lats_pjm (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER REFERENCES lats_projects(id) ON DELETE CASCADE,
  village_id  INTEGER REFERENCES lats_villages(id) ON DELETE CASCADE,
  jm_date     VARCHAR(20),
  sheet_date  VARCHAR(20),
  la_length_jm NUMERIC(12,4)
);

CREATE TABLE IF NOT EXISTS lats_pjm_guts (
  id          SERIAL PRIMARY KEY,
  pjm_id      INTEGER REFERENCES lats_pjm(id) ON DELETE CASCADE,
  gut_number  VARCHAR(50),
  mod_area    NUMERIC(12,4)
);

CREATE TABLE IF NOT EXISTS lats_p3d (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER REFERENCES lats_projects(id) ON DELETE CASCADE,
  village_id  INTEGER REFERENCES lats_villages(id) ON DELETE CASCADE,
  notif_date   VARCHAR(20),
  la_length_3d NUMERIC(12,4)
);

CREATE TABLE IF NOT EXISTS lats_p3d_guts (
  id           SERIAL PRIMARY KEY,
  p3d_id       INTEGER REFERENCES lats_p3d(id) ON DELETE CASCADE,
  gut_number   VARCHAR(50),
  area         NUMERIC(12,4),
  beneficiary  VARCHAR(300),
  land_type    VARCHAR(50) DEFAULT 'Private Land'
);

CREATE TABLE IF NOT EXISTS lats_p3g (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER REFERENCES lats_projects(id) ON DELETE CASCADE,
  village_id  INTEGER REFERENCES lats_villages(id) ON DELETE CASCADE,
  notif_date   VARCHAR(20),
  la_length_3g NUMERIC(12,4)
);

CREATE TABLE IF NOT EXISTS lats_p3g_guts (
  id            SERIAL PRIMARY KEY,
  p3g_id        INTEGER REFERENCES lats_p3g(id) ON DELETE CASCADE,
  gut_number    VARCHAR(50),
  compensation  NUMERIC(15,2),
  land_type     VARCHAR(50) DEFAULT 'Private Land'
);

-- Add new columns if not exist (safe migration)
ALTER TABLE lats_projects ADD COLUMN IF NOT EXISTS la_length_tafs NUMERIC(12,4);
ALTER TABLE lats_p3a ADD COLUMN IF NOT EXISTS la_length_3a NUMERIC(12,4);
ALTER TABLE lats_pjm ADD COLUMN IF NOT EXISTS la_length_jm NUMERIC(12,4);
ALTER TABLE lats_p3d ADD COLUMN IF NOT EXISTS la_length_3d NUMERIC(12,4);
ALTER TABLE lats_p3g ADD COLUMN IF NOT EXISTS la_length_3g NUMERIC(12,4);

-- Default admin (password: CENHMAH123)
INSERT INTO lats_users (username, password, name, role)
VALUES ('CENH', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin')
ON CONFLICT (username) DO UPDATE SET password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
