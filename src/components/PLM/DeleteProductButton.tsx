import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Deletes an R&D product after asking for the password again. The database
 * checks the password and the rights (Management, Admin) and refuses while the
 * model is in use, saying why.
 */
export function DeleteProductButton({ product }: { product: { id: string; product_code: string; name: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => { setOpen(false); setPassword(""); setError(""); };
  const run = async () => {
    setBusy(true); setError("");
    const { error: e } = await (supabase as any).rpc("plm_product_delete", { p_product: product.id, p_password: password });
    setBusy(false);
    if (e) { setError(e.message); setPassword(""); return; }
    toast.success(`${product.product_code} deleted`);
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("plm") || q.queryKey[0] === "parts" });
    close();
  };

  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${product.product_code}`} title={`Delete ${product.product_code}`}
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {product.product_code}?</DialogTitle>
            <DialogDescription>
              {product.name}. Its stages, tests, issues, CRS and its model code go with it, and the number can be used again.
              This cannot be undone. It is refused if the model already has brand codes or is used in production, stock or a BOM.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (password) run(); }}>
            <label className="space-y-1 text-sm">
              <span>Enter your password to confirm</span>
              <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={!password || busy}>{busy ? "Deleting…" : "Delete"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
