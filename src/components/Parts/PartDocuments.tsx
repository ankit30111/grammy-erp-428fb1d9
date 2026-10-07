import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, ImageOff, Maximize2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
          <img src={preview} alt="Selected part photo" className="aspect-[4/3] w-24 rounded-md border bg-muted object-contain" />
        ) : showCurrent ? (
          <PartPhoto path={current} size={96} />
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

/** Every part photo is shown in this one frame shape, the whole image fitted inside (never cropped). */
export const PHOTO_RATIO = "aspect-[4/3]";

/**
 * The photo full size, on this page: a dialog over the current one. Esc or the
 * close button goes back to where you were.
 */
export function PartPhotoViewer({ path, open, onOpenChange, code, name }: {
  path?: string | null; open: boolean; onOpenChange: (o: boolean) => void; code?: string | null; name?: string | null;
}) {
  const { data: url } = useSignedStorageUrl(BUCKET, open ? path ?? null : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,1100px)] max-w-none gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-mono">{code ?? "Part photo"}</DialogTitle>
          <DialogDescription>{name ? `${name} · ` : ""}Press Esc to go back.</DialogDescription>
        </DialogHeader>
        <div className={cn(PHOTO_RATIO, "w-full overflow-hidden rounded-md border bg-muted max-h-[75vh]")}>
          {url
            ? <img src={url} alt={code ? `Photo of ${code}` : "Part photo"} className="h-full w-full object-contain" />
            : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A part's photo as a small 4:3 thumbnail; click opens it full size on this page. */
export function PartPhoto({ path, size = 64, label, name, className }: {
  path?: string | null; size?: number; label?: string | null; name?: string | null; className?: string;
}) {
  const [viewing, setViewing] = useState(false);
  const { data: url } = useSignedStorageUrl(BUCKET, path ?? null);
  const box = { width: size };
  if (!path) {
    return (
      <div style={box} title="No photo" className={cn(PHOTO_RATIO, "flex shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground", className)}>
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setViewing(true)} title="Open photo" style={box}
              className={cn(PHOTO_RATIO, "shrink-0 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
        {url && <img src={url} alt={label ? `Photo of ${label}` : "Part photo"} className="h-full w-full object-contain" />}
      </button>
      <PartPhotoViewer path={path} open={viewing} onOpenChange={setViewing} code={label} name={name} />
    </>
  );
}

/** The large photo at the top of a part's page: fills its column at 4:3; click to see it full size. */
export function PartPhotoPanel({ path, code, name, className }: {
  path?: string | null; code?: string | null; name?: string | null; className?: string;
}) {
  const [viewing, setViewing] = useState(false);
  const { data: url } = useSignedStorageUrl(BUCKET, path ?? null);
  if (!path) {
    return (
      <div className={cn(PHOTO_RATIO, "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground", className)}>
        <ImageOff className="h-8 w-8" />
        <span className="text-sm">No photo yet</span>
        <span className="text-xs">Add one with Edit</span>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setViewing(true)} aria-label={`Open the photo of ${code ?? "this part"}`}
              className={cn(PHOTO_RATIO, "group relative w-full overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
        {url && <img src={url} alt={code ? `Photo of ${code}` : "Part photo"} className="h-full w-full object-contain" />}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm opacity-90 group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" /> Click to enlarge
        </span>
      </button>
      <PartPhotoViewer path={path} open={viewing} onOpenChange={setViewing} code={code} name={name} />
    </>
  );
}

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

/** A part document (PDF) shown on this page in a dialog. Esc goes back. */
export function PartDocViewer({ path, open, onOpenChange, title, fileName }: {
  path?: string | null; open: boolean; onOpenChange: (o: boolean) => void; title: string; fileName: string;
}) {
  // Loaded as a file and shown from memory, so the browser always displays it
  // in the page instead of downloading it or refusing to frame another site.
  const [url, setUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  useEffect(() => {
    if (!open || !path) return;
    let objectUrl: string | null = null; let live = true;
    setUrl(null); setIsError(false);
    supabase.storage.from(BUCKET).download(path).then(({ data, error }) => {
      if (!live) return;
      if (error || !data) { setIsError(true); return; }
      objectUrl = URL.createObjectURL(new Blob([data], { type: data.type || "application/pdf" }));
      setUrl(objectUrl);
    });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, path]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[min(94vw,1100px)] max-w-none flex-col gap-3 p-4 sm:p-6">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>Press Esc to go back.</DialogDescription>
            </div>
            {path && (
              <Button variant="outline" size="sm" onClick={() => download(path, fileName)}>
                <Download /> Download
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted">
          {url ? <iframe src={url} title={title} className="h-full w-full" />
            : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{isError ? "Could not open the document" : "Loading…"}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The documents this kind of part needs, as compact buttons; each opens on this page. Missing ones say so. */
export function PartDocButtons({ tier, part }: { tier: PartTier; part: Record<string, any> }) {
  const [openKey, setOpenKey] = useState<PartDocKey | null>(null);
  const keys = DOCS_FOR_TIER[tier];
  const SHORT: Record<PartDocKey, string> = { spec: "Spec Sheet", iqc: "IQC Checklist", cir: "CIR Sheet", pqc: "PQC Checklist", oqc: "OQC Checklist" };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => {
          const path: string | null = part[PART_DOCS[k].column];
          return path ? (
            <Button key={k} type="button" variant="outline" size="sm" onClick={() => setOpenKey(k)}>
              <FileText /> {SHORT[k]}
            </Button>
          ) : (
            <span key={k} title={`${PART_DOCS[k].label} not uploaded`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> {SHORT[k]} <span className="text-destructive">missing</span>
            </span>
          );
        })}
      </div>
      {openKey && (
        <PartDocViewer path={part[PART_DOCS[openKey].column]} open={!!openKey} onOpenChange={(o) => !o && setOpenKey(null)}
                       title={`${part.part_code} · ${PART_DOCS[openKey].label}`}
                       fileName={`${part.part_code} ${PART_DOCS[openKey].label}.pdf`} />
      )}
    </>
  );
}
