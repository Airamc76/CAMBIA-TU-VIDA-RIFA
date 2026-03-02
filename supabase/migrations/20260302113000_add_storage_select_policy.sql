-- Re-add public select policy for comprobantes bucket
DO $$
BEGIN
    -- Drop existing SELECT policy if it exists to avoid conflicts
    DROP POLICY IF EXISTS "Public view" ON storage.objects;
    
    -- Create the policy to allow everyone to view objects in the 'comprobantes' bucket
    CREATE POLICY "Public view" ON storage.objects
    FOR SELECT USING (bucket_id = 'comprobantes');
END $$;
