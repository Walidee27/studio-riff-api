CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE rooms (
  id text PRIMARY KEY,
  name text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  maintenance_start timestamptz,
  maintenance_end timestamptz,
  CONSTRAINT rooms_maintenance_complete CHECK ((maintenance_start IS NULL) = (maintenance_end IS NULL)),
  CONSTRAINT rooms_maintenance_order CHECK (maintenance_end > maintenance_start)
);

CREATE TABLE members (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE bookings (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms (id),
  member_id text NOT NULL REFERENCES members (id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT bookings_status_valid CHECK (status IN ('confirmed', 'cancelled', 'late_cancelled')),
  CONSTRAINT bookings_duration CHECK (end_at - start_at BETWEEN interval '1 hour' AND interval '4 hours'),
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX bookings_member ON bookings (member_id);
