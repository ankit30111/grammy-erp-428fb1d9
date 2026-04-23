import * as React from "react";
import { toast } from "sonner";
import { Button, ButtonProps } from "@/components/ui/button";
import { extractStoragePath, getSignedStorageUrl } from "@/hooks/useSignedStorageUrl";

interface SignedStorageLinkProps extends Omit<ButtonProps, "onClick" | "asChild"> {
  bucket: string;
  /**
   * Either a bare storage path (`folder/file.pdf`) OR a legacy full public URL
   * containing `/storage/v1/object/public/<bucket>/...`. Full URLs are auto-
   * trimmed to the bucket-relative path before signing.
   */
  path: string | null | undefined;
  /** TTL in seconds for the signed URL. Default 1 hour. */
  ttlSeconds?: number;
  /** Children render normally inside the button. */
  children: React.ReactNode;
}

/**
 * Renders a Button that, on click, requests a short-lived signed Storage URL
 * and opens it in a new tab. Replaces the old hardcoded
 * `https://<project>.supabase.co/storage/v1/object/public/...` anchor pattern
 * which only worked for public buckets.
 *
 * Works against both public and private buckets (signed URL bypasses the
 * bucket-public flag), so it's safe to roll out before flipping buckets to
 * private.
 */
export function SignedStorageLink({
  bucket,
  path,
  ttlSeconds = 60 * 60,
  children,
  disabled,
  ...rest
}: SignedStorageLinkProps) {
  const [pending, setPending] = React.useState(false);

  const handleClick = async () => {
    if (!path) return;
    const objectPath = extractStoragePath(path, bucket);
    if (!objectPath) {
      toast.error("Document link is malformed");
      return;
    }
    setPending(true);
    try {
      const url = await getSignedStorageUrl(bucket, objectPath, ttlSeconds);
      if (!url) {
        toast.error("Could not generate document link");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || !path || pending}
      {...rest}
    >
      {children}
    </Button>
  );
}
