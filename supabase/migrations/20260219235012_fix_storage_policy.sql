-- Fix storage policy conflict
-- This migration handles the case where the policy already exists

DO $$
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Public upload" ON storage.objects;
    
    -- Recreate the policy
    CREATE POLICY "Public upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'comprobantes');
END $$;