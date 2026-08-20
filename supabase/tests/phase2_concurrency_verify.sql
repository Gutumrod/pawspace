\set ON_ERROR_STOP on
DO $$
DECLARE c int; s uuid; u uuid;
BEGIN
  SELECT count(*) INTO c FROM booking_pets WHERE pet_id=(SELECT pet_id FROM phase2_test.fixture LIMIT 1);
  IF c <> 1 THEN RAISE EXCEPTION 'same-pet race expected exactly one assignment, got %', c; END IF;
  SELECT shop_id,u1 INTO s,u FROM phase2_test.fixture LIMIT 1;
  DELETE FROM booking_pets WHERE shop_id=s;
  DELETE FROM bookings WHERE shop_id=s;
  DELETE FROM pets WHERE shop_id=s;
  DELETE FROM pet_owners WHERE shop_id=s;
  DELETE FROM rooms WHERE shop_id=s;
  DELETE FROM staff_users WHERE shop_id=s;
  DELETE FROM shops WHERE id=s;
  DELETE FROM auth.users WHERE id=u;
END $$;
DROP SCHEMA phase2_test CASCADE;
