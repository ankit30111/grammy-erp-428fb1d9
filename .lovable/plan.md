Add a serial number (S.No.) column at the start of the Raw Materials table so users can see the total count and row position of each part code.

## Changes
File: `src/pages/management/RawMaterialsManagement.tsx`

1. Insert `<TableHead className="w-12">S.No.</TableHead>` as the first header in `<TableRow>` (before Part Code).
2. Update `colSpan={7}` to `colSpan={8}` on the loading and empty-state rows.
3. In `sortedMaterials.map((material, index) => ...)`, render `<TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>` as the first cell before the part code cell.

No API or database changes needed — purely client-side rendering.