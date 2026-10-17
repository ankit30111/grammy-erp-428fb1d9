/**
 * Every document / image upload in the app takes JPG, PNG or PDF.
 * No size limit of our own; the storage plan caps one file at 50 MB.
 */
export const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const DOC_FORMATS = "PDF / JPG / PNG";
export const STORAGE_MAX_MB = 50;

export const isDocFile = (f: File) =>
  /\.(pdf|jpe?g|png)$/i.test(f.name) || ["application/pdf", "image/jpeg", "image/png"].includes(f.type);

/** null when the file is fine, otherwise what to tell the user. */
export const docFileProblem = (f: File, extra: string[] = []) =>
  !isDocFile(f) && !extra.some((x) => f.name.toLowerCase().endsWith(x))
    ? `Choose a ${DOC_FORMATS}${extra.length ? ` (or ${extra.join(", ")})` : ""} file`
    : f.size > STORAGE_MAX_MB * 1024 * 1024
      ? `${f.name} is ${(f.size / 1048576).toFixed(0)} MB; one file can be up to ${STORAGE_MAX_MB} MB on the current storage plan`
      : null;

export const isPdfPath = (p?: string | null) => !!p && /\.pdf$/i.test(p);
/** "…/1700_spec.PNG" → ".png"; documents without one are PDFs. */
export const extOf = (p?: string | null) => (p?.match(/\.(pdf|jpe?g|png)$/i)?.[0] ?? ".pdf").toLowerCase();
