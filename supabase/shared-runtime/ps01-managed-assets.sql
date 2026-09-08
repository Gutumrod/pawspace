-- GENERATED FILE. PLATFORM-ADMIN MANAGED-ASSET APPLY ONLY.
DO $$ BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'PS01 managed assets require platform-admin postgres session.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ps01') THEN
    RAISE EXCEPTION 'PS01 schema must exist before managed assets are applied.';
  END IF;
END $$;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ps01-daily-report-photos', 'ps01-daily-report-photos', TRUE, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/tiff','image/bmp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
