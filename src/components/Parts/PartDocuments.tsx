import { useEffect, useState } from "react";
import { Download, ExternalLink, ImageOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";
import { cn } from "@/lib/utils";
import { DOCS_FOR_TIER, PART_DOCS, type PartDocKey, type PartTier } from "@/hooks/usePartCategories";
import type { PartInput } from "@/hooks/useParts";

export type DocFiles = Partial<Record<PartDocKey, File | null>> & {
  /** Photo of the part. Optional for every kind of part. */
  image?: File | null;
  /** Clear the photo on file (edit only). */
  removeImage?: boolean;
};

const MAX_IMAGE_MB = 5;

const INPUT_FIELD: Record<PartDocKey, keyof PartInput> = {
  spec: "specificationFile",
  iqc: "iqcChecklistFile",
  cir: "cirSheetFile",
  pqc: "pqcChecklistFile",
  oqc: "oqcChecklistFile",
};

/** The picked files, as the fields useParts uploads. Only this tier's documents. */
export const docFilesToInput = (tier: PartTier, files: DocFiles): Partial<PartInput> => ({
  ...Object.fromEntries(
    DOCS_FOR_TIER[tier].filter((k) => files[k]).map((k) => [INPUT_FIELD[k], files[k] as File]),
  ),
  ...(files.image ? { imageFile: files.image } : {}),
  ...(!files.image && files.removeImage ? { removeImage: true } : {}),
});

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
    <PartPhotoInput files={files} onChange={onChange} current={part?.image_url} />
  </>
);

/** Photo picker: shows the photo on file (or the one just picked) and lets it be replaced or removed. */
function PartPhotoInput({ files, onChange, current }: {
  files: DocFiles; onChange: (files: DocFiles) => void; current?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!files.image) { setPreview(null); return; }
    const url = URL.createObjectURL(files.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [files.image]);
  const showCurrent = !!current && !files.image && !files.removeImage;
  return (
    <div className="space-y-2">
      <Label htmlFor="part-photo">
        Part photo (JPG / PNG, optional)
        {current && <span className="ml-2 text-xs text-muted-foreground">{files.removeImage ? "will be removed" : "on file"}</span>}
      </Label>
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="Selected part photo" className="h-16 w-16 rounded-md border object-cover" />
        ) : showCurrent ? (
          <PartPhoto path={current} size={64} />
        ) : null}
        <div className="flex-1 space-y-1.5">
          <Input id="part-photo" type="file" accept="image/*"
                 onChange={(e) => {
                   const f = e.target.files?.[0] ?? null;
                   if (f && !f.type.startsWith("image/")) { toast.error("Choose an image file (JPG or PNG)"); e.target.value = ""; return; }
                   if (f && f.size > MAX_IMAGE_MB * 1024 * 1024) { toast.error(`The photo is larger than ${MAX_IMAGE_MB} MB. Choose a smaller one.`); e.target.value = ""; return; }
                   onChange({ ...files, image: f, removeImage: false });
                 }} />
          {showCurrent && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                    onClick={() => onChange({ ...files, image: null, removeImage: true })}>
              <Trash2 /> Remove photo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A part's photo as a thumbnail; click opens it full size. Renders a quiet placeholder when there is none. */
export function PartPhoto({ path, size = 64, label, className }: {
  path?: string | null; size?: number; label?: string | null; className?: string;
}) {
  const { data: url } = useSignedStorageUrl(BUCKET, path ?? null);
  const box = { width: size, height: size };
  if (!path) {
    return (
      <div style={box} title="No photo" className={cn("flex shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground", className)}>
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => open(path)} title="Open photo" style={box}
            className={cn("shrink-0 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {url && <img src={url} alt={label ? `Photo of ${label}` : "Part photo"} className="h-full w-full object-cover" />}
    </button>
  );
}

/** The documents this kind of part needs, each opened from here or marked missing. */
export const PartDocumentList = ({ tier, part }: { tier: PartTier; part: Record<string, any> }) => (
  <div className="divide-y rounded-md border">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <span className="text-sm">Part photo</span>
      <div className="flex items-center gap-2">
        <PartPhoto path={part.image_url} size={72} label={part.part_code} />
      </div>
    </div>
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
