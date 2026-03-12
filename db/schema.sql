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
ALTER TABLE lats_projects ADD COLUMN IF NOT EXISTS tafs_date VARCHAR(20);
ALTER TABLE lats_p3a ADD COLUMN IF NOT EXISTS la_length_3a NUMERIC(12,4);
ALTER TABLE lats_pjm ADD COLUMN IF NOT EXISTS la_length_jm NUMERIC(12,4);
ALTER TABLE lats_p3d ADD COLUMN IF NOT EXISTS la_length_3d NUMERIC(12,4);
ALTER TABLE lats_p3g ADD COLUMN IF NOT EXISTS la_length_3g NUMERIC(12,4);
ALTER TABLE lats_pjm_guts ADD COLUMN IF NOT EXISTS is_addl BOOLEAN DEFAULT FALSE;

-- Sr. No support for multiple entries per village
ALTER TABLE lats_p3a  ADD COLUMN IF NOT EXISTS sr_no   INTEGER DEFAULT 1;
ALTER TABLE lats_p3a  ADD COLUMN IF NOT EXISTS sr_name VARCHAR(100) DEFAULT 'Main';
ALTER TABLE lats_pjm  ADD COLUMN IF NOT EXISTS sr_no   INTEGER DEFAULT 1;
ALTER TABLE lats_pjm  ADD COLUMN IF NOT EXISTS sr_name VARCHAR(100) DEFAULT 'Main';
ALTER TABLE lats_p3d  ADD COLUMN IF NOT EXISTS sr_no   INTEGER DEFAULT 1;
ALTER TABLE lats_p3d  ADD COLUMN IF NOT EXISTS sr_name VARCHAR(100) DEFAULT 'Main';
ALTER TABLE lats_p3g  ADD COLUMN IF NOT EXISTS sr_no   INTEGER DEFAULT 1;
ALTER TABLE lats_p3g  ADD COLUMN IF NOT EXISTS sr_name VARCHAR(100) DEFAULT 'Main';

-- Default admin (password: CENHMAH123)
INSERT INTO lats_users (username, password, name, role)
VALUES ('CENH', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin')
ON CONFLICT (username) DO UPDATE SET password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

-- ── NH Management Module ──

ALTER TABLE lats_users ADD COLUMN IF NOT EXISTS division VARCHAR(200);

CREATE TABLE IF NOT EXISTS lats_project_types (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lats_nh (
  id              SERIAL PRIMARY KEY,
  nh_number       VARCHAR(100) NOT NULL,
  description     VARCHAR(500),
  chainage_from   NUMERIC(10,3),
  chainage_to     NUMERIC(10,3),
  length          NUMERIC(10,3),
  state           VARCHAR(200),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lats_nh_stretches (
  id              SERIAL PRIMARY KEY,
  nh_id           INTEGER REFERENCES lats_nh(id) ON DELETE CASCADE,
  name            VARCHAR(300),
  chainage_from   NUMERIC(10,3),
  chainage_to     NUMERIC(10,3),
  length          NUMERIC(10,3),
  description     VARCHAR(500),
  district        VARCHAR(200),
  taluka          VARCHAR(200),
  division        VARCHAR(200),
  project_id      INTEGER REFERENCES lats_projects(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lats_contracts (
  id                    SERIAL PRIMARY KEY,
  project_id            INTEGER REFERENCES lats_projects(id) ON DELETE CASCADE,
  stretch_id            INTEGER REFERENCES lats_nh_stretches(id) ON DELETE SET NULL,
  project_type_id       INTEGER REFERENCES lats_project_types(id) ON DELETE SET NULL,
  contractor_name       VARCHAR(300),
  contractor_address    TEXT,
  contractor_contact    VARCHAR(100),
  cost_put_to_tender    NUMERIC(15,2),
  contract_price        NUMERIC(15,2),
  pct_above_below       NUMERIC(8,4),
  agreement_date        VARCHAR(20),
  appointed_date        VARCHAR(20),
  schedule_completion   VARCHAR(20),
  eot_date              VARCHAR(20),
  dlp_date              VARCHAR(20),
  remarks               TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- Default project types
INSERT INTO lats_project_types (name) VALUES ('Road Construction') ON CONFLICT (name) DO NOTHING;
INSERT INTO lats_project_types (name) VALUES ('Bridge Construction') ON CONFLICT (name) DO NOTHING;
INSERT INTO lats_project_types (name) VALUES ('Flyover') ON CONFLICT (name) DO NOTHING;
INSERT INTO lats_project_types (name) VALUES ('Tunnel') ON CONFLICT (name) DO NOTHING;
INSERT INTO lats_project_types (name) VALUES ('Bypass') ON CONFLICT (name) DO NOTHING;

-- Stretch taluka breakup (multi-district/taluka with chainage)
CREATE TABLE IF NOT EXISTS lats_stretch_talukas (
  id            SERIAL PRIMARY KEY,
  stretch_id    INTEGER REFERENCES lats_nh_stretches(id) ON DELETE CASCADE,
  district      VARCHAR(200),
  taluka        VARCHAR(200),
  chainage_from NUMERIC(10,3),
  chainage_to   NUMERIC(10,3),
  length        NUMERIC(10,3),
  sort_order    INTEGER DEFAULT 0
);

-- User Permissions
CREATE TABLE IF NOT EXISTS lats_user_permissions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES lats_users(id) ON DELETE CASCADE,
  module      VARCHAR(50) NOT NULL,
  can_view    BOOLEAN DEFAULT TRUE,
  can_edit    BOOLEAN DEFAULT TRUE,
  can_delete  BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, module)
);
