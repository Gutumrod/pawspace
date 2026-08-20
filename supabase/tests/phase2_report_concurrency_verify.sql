\set ON_ERROR_STOP on
DO $$
DECLARE dup_count int; race_count int; st text; room_st text; s uuid; u uuid;
BEGIN
  SELECT count(*) INTO dup_count FROM daily_reports
    WHERE shop_id=(SELECT shop_id FROM phase2_report_test.fixture LIMIT 1)
      AND idempotency_key=(SELECT idem_dup FROM phase2_report_test.fixture LIMIT 1);
  IF dup_count <> 1 THEN RAISE EXCEPTION 'duplicate idempotency race expected 1 row, got %', dup_count; END IF;
  SELECT count(*) INTO race_count FROM daily_reports
    WHERE shop_id=(SELECT shop_id FROM phase2_report_test.fixture LIMIT 1)
      AND idempotency_key=(SELECT idem_race FROM phase2_report_test.fixture LIMIT 1);
  IF race_count <> 0 THEN RAISE EXCEPTION 'checkout/report race committed stale report'; END IF;
  SELECT booking_status INTO st FROM bookings WHERE id=(SELECT booking_race FROM phase2_report_test.fixture LIMIT 1);
  SELECT status INTO room_st FROM rooms WHERE id=(SELECT room_race FROM phase2_report_test.fixture LIMIT 1);
  IF st <> 'checked_out' OR room_st <> 'cleaning' THEN RAISE EXCEPTION 'checkout race final lifecycle state invalid'; END IF;
  SELECT shop_id,u1 INTO s,u FROM phase2_report_test.fixture LIMIT 1;
  DELETE FROM daily_reports WHERE shop_id=s;
  DELETE FROM booking_pets WHERE shop_id=s;
  DELETE FROM bookings WHERE shop_id=s;
  DELETE FROM pets WHERE shop_id=s;
  DELETE FROM pet_owners WHERE shop_id=s;
  DELETE FROM rooms WHERE shop_id=s;
  DELETE FROM staff_users WHERE shop_id=s;
  DELETE FROM shops WHERE id=s;
  DELETE FROM auth.users WHERE id=u;
END $$;
DROP SCHEMA phase2_report_test CASCADE;
