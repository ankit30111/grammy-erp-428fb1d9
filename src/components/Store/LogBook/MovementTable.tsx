
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { getMovementIcon, getMovementBadge, getQuantityStyle, getQuantityPrefix } from "./MovementUtils";
import type { MaterialMovement } from "./useMovementData";

interface MovementTableProps {
  movements: MaterialMovement[];
}

export const MovementTable = ({ movements }: MovementTableProps) => {
  return (
    <div className="w-full overflow-x-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Material Code</TableHead>
            <TableHead>Material Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Balance After</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getMovementIcon(movement.movement_type)}
                  <div>
                    <p className="font-medium">
                      {format(new Date(movement.created_at), "MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(movement.created_at), "HH:mm:ss")}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{getMovementBadge(movement.movement_type)}</TableCell>
              <TableCell className="font-mono font-medium">
                {movement.parts?.part_code}
              </TableCell>
              <TableCell>{movement.parts?.name}</TableCell>
              <TableCell className="font-semibold">
                <span className={getQuantityStyle(movement.qtyDelta)}>
                  {getQuantityPrefix(movement.qtyDelta)}{movement.quantity}
                </span>
              </TableCell>
              <TableCell className="text-sm" title={movement.location_name ?? undefined}>
                {movement.location_code ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {movement.balance_after ?? "—"}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{movement.reference_type}</p>
                  <p className="text-xs text-muted-foreground">{movement.reference_number}</p>
                </div>
              </TableCell>
              <TableCell className="max-w-xs">
                <p className="text-sm truncate" title={movement.notes}>
                  {movement.notes}
                </p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
