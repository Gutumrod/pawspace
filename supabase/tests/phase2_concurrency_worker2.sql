\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub',(SELECT u1::text FROM phase2_test.fixture LIMIT 1),false);
SET ROLE authenticated;
SELECT add_pet_to_booking((SELECT b2 FROM phase2_test.fixture LIMIT 1),(SELECT pet_id FROM phase2_test.fixture LIMIT 1));
