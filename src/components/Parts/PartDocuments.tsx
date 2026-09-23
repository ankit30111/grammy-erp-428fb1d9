import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DOCS_FOR_TIER, PART_DOCS, type PartDocKey, type PartTier } from "@/hooks/usePartCategories";
import type { PartInput } from "@/hooks/useParts";

export type DocFiles = Partial<Record<PartDocKey, File | null>>;

const INPUT_FIELD: Record<PartDocKey, keyof PartInput> = {
  spec: "specificationFile",
  iqc: "iqcChecklistFile",
  cir: "cirSheetFile",
  pqc: "pqcChecklistFile",
  oqc: "oqcChecklistFile",
};

/** The picked files, as the fields useParts uploads. Only this tier's documents. */
export const docFilesToInput = (tier: PartTier, files: DocFiles): Partial<PartInput> =>
  Object.fromEntries(
    DOCS_FOR_TIER[tier].filter((k) => files[k]).map((k) => [INPUT_FIELD[k], files[k] as File]),
  );

const BUCKET = "raw-material-documents";

const open = async (path: string) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return toast.error("Could not open the document");
  window.open(data.signedUrl, "_blank", "noopener");
};

const download = async (path: string, name: string) => {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return toast.error("Could not download the document");
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
};

/** File pickers for the documents this kind of part needs. On an existing part
 *  each says whether one is already on file; a new file replaces it. */
export const PartDocumentInputs = ({
  tier, files, onChange, part,
}: {
  tier: PartTier;
  files: DocFiles;
  onChange: (files: DocFiles) => void;
  part?: Record<string, any> | null;
}) => (
  <>
    {DOCS_FOR_TIER[tier].map((k) => {
      const onFile = part?.[PART_DOCS[k].column];
      return (
        <div key={k} className="space-y-2">
          <Label>
            {PART_DOCS[k].label} (PDF) *
            {part && (
              <span className={onFile ? "ml-2 text-xs text-muted-foreground" : "ml-2 text-xs text-destructive"}>
                {onFile ? "on file" : "missing"}
              </span>
            )}
          </Label>
          <Input type="file" accept=".pdf"
                 onChange={(e) => onChange({ ...files, [k]: e.target.files?.[0] ?? null })} />
        </div>
      );
    })}
  </>
);

/** The documents this kind of part needs, each opened from here or marked missing. */
export const PartDocumentList = ({ tier, part }: { tier: PartTier; part: Record<string, any> }) => (
  <div className="divide-y rounded-md border">
    {DOCS_FOR_TIER[tier].map((k) => {
      const path: string | null = part[PART_DOCS[k].column];
      return (
        <div key={k} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm">{PART_DOCS[k].label}</span>
          {path ? (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => open(path)}><ExternalLink /> View</Button>
              <Button variant="outline" size="sm"
                      onClick={() => download(path, `${part.part_code} ${PART_DOCS[k].label}.pdf`)}>
                <Download /> Download
              </Button>
            </div>
          ) : (
            <span className="text-sm text-destructive">Missing</span>
          )}
        </div>
      );
    })}
  </div>
);
