import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, ImageOff, Maximize2, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";
import { cn } from "@/lib/utils";
import { DOC_ACCEPT, DOC_FORMATS, docFileProblem, extOf, isPdfPath } from "@/lib/uploads";
import { DOCS_FOR_TIER, PART_DOCS, type PartDocKey, type PartTier } from "@/hooks/usePartCategories";
import type { PartInput } from "@/hooks/useParts";

export type DocFiles = Partial<Record<PartDocKey, File | null>> & {
  /** Photo of the part. Optional for every kind of part. */
  image?: File | null;
  /** Clear the photo on file (edit only). */
  removeImage?: boolean;
};

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

/**
 * The part's files, one per line: photo first, then the documents this kind of
 * part needs. Each line says what is on file and offers Upload / Replace (and
 * Remove for the photo); nothing changes until the form is saved.
 */
export const PartDocumentInputs = ({
  tier, files, onChange, part,
}: {
  tier: PartTier;
  files: DocFiles;
  onChange: (files: DocFiles) => void;
  part?: Record<string, any> | null;
}) => (
  <div className="space-y-2 sm:col-span-2">
    <Label>Image and documents</Label>
    <div className="divide-y rounded-md border">
      <PartPhotoInput files={files} onChange={onChange} current={part?.image_url} />
      {DOCS_FOR_TIER[tier].map((k) => (
        <DocRow key={k} label={PART_DOCS[k].label} onFile={part ? part[PART_DOCS[k].column] : undefined} isEdit={!!part}
                picked={files[k] ?? null} onPick={(f) => onChange({ ...files, [k]: f })} />
      ))}
    </div>
  </div>
);

/** A picker that looks like a button. */
function PickButton({ label, accept, onPick }: { label: string; accept: string; onPick: (f: File) => void }) {
  return (
    <Button asChild type="button" variant="outline" size="sm" className="h-8 cursor-pointer">
      <label>
        <Upload className="h-4 w-4" /> {label}
        <input type="file" accept={accept} className="sr-only"
               onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
      </label>
    </Button>
  );
}

function DocRow({ label, onFile, isEdit, picked, onPick }: {
  label: string; onFile?: string | null; isEdit: boolean; picked: File | null; onPick: (f: File | null) => void;
}) {
  const [viewing, setViewing] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label} <span className="font-normal text-muted-foreground">({DOC_FORMATS})</span></div>
        <div className="truncate text-xs">
          {picked ? <span className="text-primary">{picked.name} · saved when you press {isEdit ? "Update" : "Create"}</span>
            : onFile ? <span className="text-muted-foreground">On file</span>
            : <span className="text-destructive">{isEdit ? "Missing" : "Not added yet"}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {onFile && !picked && (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setViewing(true)}>View</Button>
        )}
        {picked
          ? <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onPick(null)}>Undo</Button>
          : <PickButton label={onFile ? "Replace" : "Upload"} accept={DOC_ACCEPT}
                        onPick={(f) => { const bad = docFileProblem(f); return bad ? toast.error(bad) : onPick(f); }} />}
      </div>
      {onFile && viewing && (
        <PartDocViewer path={onFile} open={viewing} onOpenChange={setViewing} title={label} fileName={`${label}${extOf(onFile)}`} />
      )}
    </div>
  );
}

/** The photo line: the photo on file (or the one just picked), Replace and Remove. */
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
  const pick = (f: File) => {
    const bad = docFileProblem(f);
    if (bad) return toast.error(bad);
    onChange({ ...files, image: f, removeImage: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      {preview && files.image && isPdfPath(files.image.name) ? (
        <PdfTile className="w-28" />
      ) : preview ? (
        <img src={preview} alt="New photo" className={cn(PHOTO_RATIO, "w-28 shrink-0 rounded-md border bg-muted object-contain")} />
      ) : showCurrent ? (
        <PartPhoto path={current} size={112} />
      ) : (
        <div className={cn(PHOTO_RATIO, "flex w-28 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground")}>
          <ImageOff className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Product image <span className="font-normal text-muted-foreground">({DOC_FORMATS})</span></div>
        <div className="truncate text-xs">
          {files.image ? <span className="text-primary">{files.image.name} · saved when you press Update / Create</span>
            : files.removeImage ? <span className="text-destructive">Will be removed when you press Update</span>
            : current ? <span className="text-muted-foreground">On file</span>
            : <span className="text-muted-foreground">No image</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(files.image || files.removeImage)
          ? <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onChange({ ...files, image: null, removeImage: false })}>Undo</Button>
          : <PickButton label={current ? "Replace" : "Upload"} accept={DOC_ACCEPT} onPick={pick} />}
        {showCurrent && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive"
                  onClick={() => onChange({ ...files, image: null, removeImage: true })}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
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
  const pdf = isPdfPath(path);
  const { data: url } = useSignedStorageUrl(BUCKET, open && !pdf ? path ?? null : null);
  if (pdf) return <PartDocViewer path={path} open={open} onOpenChange={onOpenChange} title={`${code ?? "Part"} · Product image`} fileName={`${code ?? "part"} image.pdf`} />;
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
        {isPdfPath(path) ? <PdfTile bare /> : url && <img src={url} alt={label ? `Photo of ${label}` : "Part photo"} className="h-full w-full object-contain" />}
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
        {isPdfPath(path) ? <PdfTile bare /> : url && <img src={url} alt={code ? `Photo of ${code}` : "Part photo"} className="h-full w-full object-contain" />}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm opacity-90 group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" /> Click to enlarge
        </span>
      </button>
      <PartPhotoViewer path={path} open={viewing} onOpenChange={setViewing} code={code} name={name} />
    </>
  );
}

/** Stands in for a photo that was uploaded as a PDF. */
function PdfTile({ className, bare }: { className?: string; bare?: boolean }) {
  return (
    <div className={cn(bare ? "h-full w-full" : cn(PHOTO_RATIO, "shrink-0 rounded-md border"), "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground", className)}>
      <FileText className="h-1/3 max-h-10 w-auto" />
      <span className="text-xs font-medium">PDF</span>
    </div>
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
                      onClick={() => download(path, `${part.part_code} ${PART_DOCS[k].label}${extOf(path)}`)}>
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

/** A part document (PDF, JPG or PNG) shown on this page in a dialog. Esc goes back. */
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
          {url ? (/\.(jpe?g|png)$/i.test(path ?? "")
            ? <img src={url} alt={title} className="h-full w-full object-contain" />
            : <iframe src={url} title={title} className="h-full w-full" />)
            : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{isError ? "Could not open the document" : "Loading…"}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The documents this kind of part needs, as compact buttons; each opens on this page. Missing ones say so. */
export function PartDocButtons({ tier, part, extra }: { tier: PartTier; part: Record<string, any>; extra?: React.ReactNode }) {
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
        {extra}
      </div>
      {openKey && (
        <PartDocViewer path={part[PART_DOCS[openKey].column]} open={!!openKey} onOpenChange={(o) => !o && setOpenKey(null)}
                       title={`${part.part_code} · ${PART_DOCS[openKey].label}`}
                       fileName={`${part.part_code} ${PART_DOCS[openKey].label}${extOf(part[PART_DOCS[openKey].column])}`} />
      )}
    </>
  );
}
