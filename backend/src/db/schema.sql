-- ProjexHub schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('student','guide','coordinator')),
  roll_no       VARCHAR(20) UNIQUE,
  department    VARCHAR(100),
  max_groups    INT DEFAULT 4,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  group_id         SERIAL PRIMARY KEY,
  group_no         VARCHAR(30) NOT NULL DEFAULT '',
  guide_id         INT REFERENCES users(user_id),
  status           VARCHAR(30) NOT NULL DEFAULT 'formed',
  result_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- a student can belong to only one group
CREATE TABLE IF NOT EXISTS group_members (
  student_id INT PRIMARY KEY REFERENCES users(user_id),
  group_id   INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topics (
  topic_id     SERIAL PRIMARY KEY,
  group_id     INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  abstract     TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  remark       TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMP,
  reviewed_by  INT REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS milestones (
  milestone_id SERIAL PRIMARY KEY,
  group_id     INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  title        VARCHAR(150) NOT NULL,
  due_date     DATE NOT NULL,
  max_marks    NUMERIC(5,2) NOT NULL DEFAULT 25,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  draft_notes  TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  document_id  SERIAL PRIMARY KEY,
  milestone_id INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE CASCADE,
  file_name    VARCHAR(255) NOT NULL,
  stored_name  VARCHAR(255) NOT NULL,
  size_bytes   INT NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  is_late      BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by  INT REFERENCES users(user_id),
  uploaded_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id    SERIAL PRIMARY KEY,
  milestone_id INT NOT NULL UNIQUE REFERENCES milestones(milestone_id) ON DELETE CASCADE,
  guide_id     INT NOT NULL REFERENCES users(user_id),
  marks        NUMERIC(5,2) NOT NULL,
  feedback     TEXT,
  reviewed_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  title       VARCHAR(150) NOT NULL,
  start_time  TIMESTAMP NOT NULL,
  end_time    TIMESTAMP NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'scheduled'
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  link       VARCHAR(200),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  log_id     SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(user_id),
  action     VARCHAR(60) NOT NULL,
  detail     TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_group ON topics(group_id);
CREATE INDEX IF NOT EXISTS idx_milestones_group ON milestones(group_id);
CREATE INDEX IF NOT EXISTS idx_documents_milestone ON documents(milestone_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
