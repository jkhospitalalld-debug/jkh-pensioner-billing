-- JKH Pensioner Billing - D1 schema

CREATE TABLE IF NOT EXISTS bills (
  bill_no TEXT PRIMARY KEY,
  bill_date TEXT,
  patient_name TEXT,
  age TEXT,
  sex TEXT,
  phone TEXT,
  lines TEXT,
  total REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (name, value) VALUES ('bill_counter', 0);
