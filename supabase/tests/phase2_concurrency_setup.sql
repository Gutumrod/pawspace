\set ON_ERROR_STOP on
DELETE FROM booking_pets WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-race-shop');
DELETE FROM bookings WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-race-shop');
DELETE FROM pets WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-race-shop');
DELETE FROM pet_owners WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-race-shop');
DELETE FROM rooms WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-race-shop');
DELETE FROM staff_users WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-race-shop');
DELETE FROM shops WHERE slug='phase2-race-shop';
DELETE FROM auth.users WHERE email='phase2-race@example.invalid';
DROP SCHEMA IF EXISTS phase2_test CASCADE;
CREATE SCHEMA phase2_test;
CREATE TABLE phase2_test.fixture(u1 uuid, shop_id uuid, owner_id uuid, pet_id uuid, b1 uuid, b2 uuid);
DO $$
DECLARE u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();
  r1 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); x1 uuid:=gen_random_uuid(); x2 uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES (u,'phase2-race@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES (s,'Phase2 Race Shop','phase2-race-shop');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active) VALUES (u,s,'phase2-race@example.invalid','Race Owner','owner',true);
  INSERT INTO pet_owners(id,shop_id,first_name,phone) VALUES (o,s,'Race Owner','0899999001');
  INSERT INTO pets(id,shop_id,owner_id,name,species) VALUES (p,s,o,'Race Pet','dog');
  INSERT INTO rooms(id,shop_id,room_number,room_type,capacity_pets,base_price_per_night) VALUES
    (r1,s,'RACE-1','standard',1,500),(r2,s,'RACE-2','standard',1,500);
  INSERT INTO bookings(id,shop_id,owner_id,room_id,check_in_date,check_out_date) VALUES
    (x1,s,o,r1,DATE '2026-11-01',DATE '2026-11-03'),(x2,s,o,r2,DATE '2026-11-02',DATE '2026-11-04');
  INSERT INTO phase2_test.fixture VALUES (u,s,o,p,x1,x2);
END $$;
GRANT USAGE ON SCHEMA phase2_test TO authenticated;
GRANT SELECT ON phase2_test.fixture TO authenticated;
