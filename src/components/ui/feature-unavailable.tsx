import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface FeatureUnavailableProps {
  /** What the screen used to show, e.g. "Store discrepancies". */
  title: string;
  /** The table(s) that were dropped in the database rebuild. */
  droppedTables: string[];
  /** Optional extra context for the reader. */
  detail?: string;
}

/**
 * Explicit empty state for a feature whose backing table was dropped in the
 * database rebuild and has NO replacement. We render this instead of an empty
 * table so nobody mistakes "no rows" for "no data exists".
 */
export const FeatureUnavailable = ({ title, droppedTables, detail }: FeatureUnavailableProps) => (
  <Card className="border-warning/30 bg-warning-wash/50">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-warning">
        {title} — not available after the rebuild
      </CardTitle>
      <CardDescription className="text-warning">
        {droppedTables.length === 1
          ? `The ${droppedTables[0]} table was removed in the database rebuild and has no replacement.`
          : `The ${droppedTables.join(", ")} tables were removed in the database rebuild and have no replacement.`}
      </CardDescription>
    </CardHeader>
    <CardContent className="text-sm text-warning">
      <p>
        This screen is showing nothing because there is nowhere left to read
        from — not because there is no data. {detail}
      </p>
    </CardContent>
  </Card>
);

export default FeatureUnavailable;
