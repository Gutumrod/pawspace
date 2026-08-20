\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub',(SELECT u1::text FROM phase2_report_test.fixture LIMIT 1),false);
SET ROLE authenticated;
SELECT create_daily_report(
  (SELECT booking_race FROM phase2_report_test.fixture LIMIT 1),
  (SELECT pet_race FROM phase2_report_test.fixture LIMIT 1),
  'finished','normal','happy',ARRAY['https://example.invalid/race.jpg'],NULL,
  (SELECT idem_race FROM phase2_report_test.fixture LIMIT 1)
);
