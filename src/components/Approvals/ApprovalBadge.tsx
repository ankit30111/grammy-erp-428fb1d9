import { Badge } from "@/components/ui/badge";

/** Shown beside a part, vendor or customer that is not approved yet. Nothing is
 *  shown once it is approved - that is the normal state. */
export const ApprovalBadge = ({ status, reason }: { status?: string | null; reason?: string | null }) => {
  if (!status || status === "APPROVED") return null;
  return status === "PENDING" ? (
    <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700 dark:text-amber-300">
      Pending approval
    </Badge>
  ) : (
    <Badge variant="outline" className="ml-2 border-destructive text-destructive" title={reason ?? undefined}>
      Rejected
    </Badge>
  );
};
