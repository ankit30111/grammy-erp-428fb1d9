
-- Create the capa-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('capa-documents', 'capa-documents', true);

-- Create storage policies for the capa-documents bucket
-- Policy to allow authenticated users to upload CAPA documents
CREATE POLICY "Allow authenticated users to upload CAPA documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'capa-documents');

-- Policy to allow public read access to CAPA documents
CREATE POLICY "Allow public read access to CAPA documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'capa-documents');

-- Policy to allow authenticated users to update their uploaded CAPA documents
CREATE POLICY "Allow authenticated users to update CAPA documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'capa-documents');

-- Policy to allow authenticated users to delete CAPA documents
CREATE POLICY "Allow authenticated users to delete CAPA documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'capa-documents');
