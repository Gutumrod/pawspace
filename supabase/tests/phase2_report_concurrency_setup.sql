\set ON_ERROR_STOP on
DELETE FROM daily_reports WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM booking_pets WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM bookings WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM pets WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM pet_owners WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM rooms WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM staff_users WHERE shop_id IN (SELECT id FROM shops WHERE slug='phase2-report-race');
DELETE FROM shops WHERE slug='phase2-report-race';
DELETE FROM auth.users WHERE email='phase2-report-race@example.invalid';
DROP SCHEMA IF EXISTS phase2_report_test CASCADE;
CREATE SCHEMA phase2_report_test;
CREATE TABLE phase2_report_test.fixture(
  u1 uuid, shop_id uuid, owner_id uuid, pet_dup uuid, pet_race uuid,
  idem_dup uuid, booking_dup uuid, room_dup uuid,
  idem_race uuid, booking_race uuid, room_race uuid
);
DO $$
DECLARE
  u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); pd uuid:=gen_random_uuid(); pr uuid:=gen_random_uuid();
  rd uuid:=gen_random_uuid(); rr uuid:=gen_random_uuid(); bd uuid:=gen_random_uuid(); br uuid:=gen_random_uuid();
  id1 uuid:=gen_random_uuid(); id2 uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES (u,'phase2-report-race@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES (s,'Phase2 Report Race','phase2-report-race');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active)
    VALUES (u,s,'phase2-report-race@example.invalid','Report Race Owner','owner',true);
  INSERT INTO pet_owners(id,shop_id,first_name,phone) VALUES (o,s,'Report Owner','0899999002');
  INSERT INTO pets(id,shop_id,owner_id,name,species) VALUES (pd,s,o,'Duplicate Pet','dog'),(pr,s,o,'Race Pet','dog');
  INSERT INTO rooms(id,shop_id,room_number,room_type,capacity_pets,base_price_per_night,status) VALUES
    (rd,s,'REPORT-DUP','standard',1,500,'occupied'),(rr,s,'REPORT-RACE','standard',1,500,'occupied');
  INSERT INTO bookings(id,shop_id,owner_id,room_id,check_in_date,check_out_date,booking_status) VALUES
    (bd,s,o,rd,pawspace_business_date(),pawspace_business_date()+1,'checked_in'),
    (br,s,o,rr,pawspace_business_date(),pawspace_business_date()+1,'checked_in');
  INSERT INTO booking_pets(shop_id,booking_id,pet_id) VALUES (s,bd,pd),(s,br,pr);
  INSERT INTO phase2_report_test.fixture VALUES (u,s,o,pd,pr,id1,bd,rd,id2,br,rr);
END $$;
GRANT USAGE ON SCHEMA phase2_report_test TO authenticated;
GRANT SELECT ON phase2_report_test.fixture TO authenticated;
