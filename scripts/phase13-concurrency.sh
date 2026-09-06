#!/usr/bin/env bash
set -euo pipefail

db_url="${PHASE13_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
log_dir="${RUNNER_TEMP:-/tmp}/pawspace-phase13-concurrency"
mkdir -p "$log_dir"

psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM shops
WHERE id IN (
  '13000000-0000-4000-8000-000000000001'::uuid,
  '13000000-0000-4000-8000-000000000002'::uuid
);

INSERT INTO shops(id, name, slug) VALUES
  ('13000000-0000-4000-8000-000000000001', 'Phase 13 Room Race', 'phase13-room-race'),
  ('13000000-0000-4000-8000-000000000002', 'Phase 13 Pet Race', 'phase13-pet-race');

INSERT INTO rooms(shop_id, room_number, room_type, capacity_pets, base_price_per_night, status)
SELECT '13000000-0000-4000-8000-000000000001', 'R-' || n, 'standard', 1, 500, 'available'
FROM generate_series(1, 9) AS n;

INSERT INTO pet_owners(id, shop_id, first_name, phone)
VALUES (
  '13000000-0000-4000-8000-000000000003',
  '13000000-0000-4000-8000-000000000002',
  'Concurrency Owner',
  '0813000000'
);

INSERT INTO pets(shop_id, owner_id, name, species)
SELECT
  '13000000-0000-4000-8000-000000000002',
  '13000000-0000-4000-8000-000000000003',
  'Seed Pet ' || n,
  'dog'
FROM generate_series(1, 299) AS n;
SQL

run_race() {
  local label="$1"
  local sql_a="$2"
  local sql_b="$3"
  local rc_a rc_b

  set +e
  psql "$db_url" -v ON_ERROR_STOP=1 -c "$sql_a" >"$log_dir/${label}-a.log" 2>&1 &
  local pid_a=$!
  psql "$db_url" -v ON_ERROR_STOP=1 -c "$sql_b" >"$log_dir/${label}-b.log" 2>&1 &
  local pid_b=$!
  wait "$pid_a"; rc_a=$?
  wait "$pid_b"; rc_b=$?
  set -e

  if (( (rc_a == 0) + (rc_b == 0) != 1 )); then
    echo "$label race expected exactly one success; got rc_a=$rc_a rc_b=$rc_b" >&2
    sed -n '1,120p' "$log_dir/${label}-a.log" >&2
    sed -n '1,120p' "$log_dir/${label}-b.log" >&2
    return 1
  fi
}

run_race "room" \
  "INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status) VALUES('13000000-0000-4000-8000-000000000001','R-10A','standard',1,500,'available');" \
  "INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status) VALUES('13000000-0000-4000-8000-000000000001','R-10B','standard',1,500,'available');"

run_race "pet" \
  "INSERT INTO pets(shop_id,owner_id,name,species) VALUES('13000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000003','Race Pet A','dog');" \
  "INSERT INTO pets(shop_id,owner_id,name,species) VALUES('13000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000003','Race Pet B','dog');"

psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM rooms WHERE shop_id='13000000-0000-4000-8000-000000000001') <> 10 THEN
    RAISE EXCEPTION 'Concurrent room inserts exceeded or failed to reach the Starter limit';
  END IF;
  IF (SELECT count(*) FROM pets WHERE shop_id='13000000-0000-4000-8000-000000000002') <> 300 THEN
    RAISE EXCEPTION 'Concurrent pet inserts exceeded or failed to reach the Starter limit';
  END IF;
END $$;
SQL

echo "Phase 13 concurrent room and pet quota races passed"
