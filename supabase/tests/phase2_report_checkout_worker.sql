\set ON_ERROR_STOP on
BEGIN;
SELECT id FROM bookings WHERE id=(SELECT booking_race FROM phase2_report_test.fixture LIMIT 1) FOR UPDATE;
SELECT pg_sleep(1);
SELECT set_config('request.jwt.claim.sub',(SELECT u1::text FROM phase2_report_test.fixture LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT update_booking_status((SELECT booking_race FROM phase2_report_test.fixture LIMIT 1),'checked_out');
COMMIT;
