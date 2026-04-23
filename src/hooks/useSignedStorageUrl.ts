import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a short-lived signed URL for a file in a Supabase Storage bucket.
 *
 * Use this everywhere we previously called `getPublicUrl(...)`. Signed URLs
 * work for both public and private buckets, so this is safe to roll out
 * before the bucket privacy migration (003f) flips the buckets.
 *
 * Cached for slightly less than the URL TTL so React Query auto-refreshes
 * before the link expires.
 */
export const useSignedStorageUrl = (
  bucket: string,
  path: string | null | undefined,
  ttlSeconds: number = 60 * 60,
) => {
  return useQuery({
    queryKey: ["signed-url", bucket, path, ttlSeconds],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, ttlSeconds);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    // Re-sign just before the link expires (TTL minus 60s, floor 30s).
    staleTime: Math.max(30_000, ttlSeconds * 1000 - 60_000),
  });
};

/**
 * Many existing DB rows store a full `https://<project>.supabase.co/storage/
 * v1/object/public/<bucket>/<path>` URL in their *_url columns. This helper
 * trims that down to just the bucket-relative `<path>` so it can be passed to
 * `createSignedUrl(bucket, path)`. New code should store raw paths instead.
 */
export const extractStoragePath = (input: string | null | undefined, bucket: string): string | null => {
  if (!input) return null;
  if (!input.startsWith("http")) return input;
  // Match: .../storage/v1/object/(public|sign|authenticated)/<bucket>/<path>
  const re = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/(.+?)(?:\\?|$)`);
  const m = input.match(re);
  return m ? decodeURIComponent(m[1]) : null;
};

/**
 * One-shot signed URL helper for non-React contexts (event handlers,
 * imperative code). Returns null on failure.
 */
export const getSignedStorageUrl = async (
  bucket: string,
  path: string,
  ttlSeconds: number = 60 * 60,
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error) {
    console.error(`createSignedUrl(${bucket}/${path}) failed:`, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
};
