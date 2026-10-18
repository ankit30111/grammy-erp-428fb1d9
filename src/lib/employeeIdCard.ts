import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

/**
 * Employee ID cards, vertical CR80 (54 × 86 mm), front and back.
 *   card — one card per page at exact size, front then back (PVC card printers)
 *   a4   — 9 fronts per A4 page, followed by a page of the matching backs laid
 *          out mirror-wise, so a long-edge duplex print lines each back up with
 *          its front. Light cut lines around every card.
 */

export const PHOTO_BUCKET = "employee-photos";
const W = 54, H = 86;
const TEAL: [number, number, number] = [35, 93, 99];
const LIGHT: [number, number, number] = [214, 233, 235];
const INK: [number, number, number] = [31, 41, 46];
const GREY: [number, number, number] = [110, 120, 124];

/** Used when the plant on the Plants page has no address yet. */
const FALLBACK = {
  name: "Grammy Acoustics",
  address: "Plot No. 26, HSIIDC Industrial Estate, Murthal, Sonipat, Haryana",
  phone: "9810867133",
};

export interface CardEmployee {
  id: string; employee_code: string; first_name: string; last_name?: string | null;
  position?: string | null; department?: string | null; hire_date?: string | null;
  emergency_contact_name?: string | null; emergency_contact_phone?: string | null;
  address?: string | null; city?: string | null; state?: string | null; pincode?: string | null;
  photo_path?: string | null;
}

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const fullName = (e: CardEmployee) => [e.first_name, e.last_name].filter(Boolean).join(" ");

async function issuer() {
  const { data } = await (supabase as any).from("plants").select("name, address_line1, address_line2, city, state, postal_code, phone")
    .eq("is_active", true).order("created_at").limit(1).maybeSingle();
  const parts = [data?.address_line1, data?.address_line2, data?.city, data?.state, data?.postal_code].filter(Boolean);
  return {
    name: FALLBACK.name,
    address: parts.length ? parts.join(", ") : FALLBACK.address,
    phone: data?.phone || FALLBACK.phone,
  };
}

/** The photo, cropped to fill a w:h frame, as a JPEG data URL (null if none / unreadable). */
async function loadPhoto(path: string | null | undefined, w: number, h: number): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (error || !data) return null;
  const url = URL.createObjectURL(data);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url;
    });
    const scale = 12; // px per mm → ~300 dpi
    const c = document.createElement("canvas"); c.width = w * scale; c.height = h * scale;
    const ctx = c.getContext("2d")!;
    const r = Math.max(c.width / img.width, c.height / img.height);
    const dw = img.width * r, dh = img.height * r;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2 * 0.6, dw, dh); // keep the face, trim more from the bottom
    return c.toDataURL("image/jpeg", 0.92);
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

function fitText(doc: jsPDF, text: string, maxW: number, size: number, min = 6) {
  let s = size; doc.setFontSize(s);
  while (s > min && doc.getTextWidth(text) > maxW) { s -= 0.5; doc.setFontSize(s); }
  return s;
}

/** Letter-spaced text centred on cx (jsPDF's own centring ignores the spacing). */
function spaced(doc: jsPDF, text: string, cx: number, y: number, space: number) {
  doc.setCharSpace(space);
  const w = doc.getTextWidth(text) + space * (text.length - 1);
  doc.text(text, cx - w / 2, y);
  doc.setCharSpace(0);
}

function front(doc: jsPDF, x: number, y: number, e: CardEmployee, photo: string | null) {
  const cx = x + W / 2;
  doc.setFillColor(...TEAL); doc.rect(x, y, W, 17, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("GRAMMY", cx, y + 9.2, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(5.6);
  spaced(doc, "ACOUSTICS", cx, y + 13.6, 1.2);

  const pw = 26, ph = 32, px = cx - pw / 2, py = y + 21;
  if (photo) doc.addImage(photo, "JPEG", px, py, pw, ph);
  else {
    doc.setFillColor(...LIGHT); doc.rect(px, py, pw, ph, "F");
    doc.setTextColor(...GREY); doc.setFontSize(6); doc.text("PHOTO", cx, py + ph / 2 + 1, { align: "center" });
  }
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.6); doc.rect(px, py, pw, ph);

  const name = fullName(e).toUpperCase();
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); fitText(doc, name, W - 6, 10.5);
  doc.text(name, cx, y + 59.5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
  if (e.position) { fitText(doc, e.position, W - 6, 7.5); doc.text(e.position, cx, y + 64.3, { align: "center" }); }
  if (e.department) {
    doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold"); fitText(doc, e.department.toUpperCase(), W - 6, 6.5);
    doc.text(e.department.toUpperCase(), cx, y + 68.4, { align: "center" });
  }
  doc.setFillColor(...LIGHT); doc.roundedRect(cx - 17, y + 71, 34, 6.4, 1.2, 1.2, "F");
  doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(`ID  ${e.employee_code}`, cx, y + 75.3, { align: "center" });

  doc.setFillColor(...TEAL); doc.rect(x, y + H - 5, W, 5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(5.2);
  spaced(doc, "EMPLOYEE IDENTITY CARD", cx, y + H - 1.8, 0.6);
}

function back(doc: jsPDF, x: number, y: number, e: CardEmployee, iss: { name: string; address: string; phone: string }) {
  const cx = x + W / 2, lx = x + 4, vw = W - 8;
  doc.setFillColor(...TEAL); doc.rect(x, y, W, 6.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(iss.name.toUpperCase(), cx, y + 4.4, { align: "center" });

  let yy = y + 11.5;
  const row = (label: string, value: string, maxLines = 1) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(5.2); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), lx, yy); yy += 2.9;
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(...INK);
    const lines = (doc.splitTextToSize(value || "—", vw) as string[]).slice(0, maxLines);
    doc.text(lines, lx, yy); yy += 2.8 * lines.length + 1.8;
  };
  row("Employee ID", e.employee_code);
  row("Date of joining", fmtDate(e.hire_date));
  row("Emergency contact", [e.emergency_contact_name, e.emergency_contact_phone].filter(Boolean).join(" · "), 2);
  row("Address", [e.address, e.city, e.state, e.pincode].filter(Boolean).join(", "), 3);

  doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3); doc.line(lx, yy - 0.5, x + W - 4, yy - 0.5); yy += 2.6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(5.4); doc.setTextColor(...GREY);
  doc.text("If found, please return to:", lx, yy); yy += 2.8;
  doc.setTextColor(...INK); doc.setFontSize(5.8); doc.setFont("helvetica", "bold");
  doc.text(iss.name, lx, yy); yy += 2.6; doc.setFont("helvetica", "normal");
  const addr = (doc.splitTextToSize(iss.address, vw) as string[]).slice(0, 3);
  doc.text(addr, lx, yy); yy += 2.5 * addr.length;
  if (iss.phone) doc.text(`Ph: ${iss.phone}`, lx, yy);

  doc.setDrawColor(...INK); doc.setLineWidth(0.2); doc.line(x + W - 24, y + H - 9.5, x + W - 4, y + H - 9.5);
  doc.setFontSize(5); doc.setTextColor(...GREY); doc.text("Authorised signatory", x + W - 14, y + H - 7.2, { align: "center" });

  doc.setFillColor(...TEAL); doc.rect(x, y + H - 5, W, 5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal");
  const note = "Company property · return on leaving";
  fitText(doc, note, W - 4, 5);
  doc.text(note, cx, y + H - 1.9, { align: "center" });
}

export async function makeIdCards(employees: CardEmployee[], layout: "card" | "a4") {
  const iss = await issuer();
  const photos = await Promise.all(employees.map((e) => loadPhoto(e.photo_path, 26, 32)));
  let doc: jsPDF;
  if (layout === "card") {
    doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait" });
    employees.forEach((e, i) => {
      if (i) doc.addPage([W, H], "portrait");
      front(doc, 0, 0, e, photos[i]);
      doc.addPage([W, H], "portrait");
      back(doc, 0, 0, e, iss);
    });
  } else {
    doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const cols = 3, rows = 3, gap = 4;
    const ox = (210 - (cols * W + (cols - 1) * gap)) / 2, oy = (297 - (rows * H + (rows - 1) * gap)) / 2;
    const cut = (x: number, y: number) => { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.rect(x, y, W, H); };
    for (let start = 0; start < employees.length; start += cols * rows) {
      const chunk = employees.slice(start, start + cols * rows);
      if (start) doc.addPage("a4", "portrait");
      chunk.forEach((e, k) => {
        const c = k % cols, r = Math.floor(k / cols);
        const x = ox + c * (W + gap), y = oy + r * (H + gap);
        front(doc, x, y, e, photos[start + k]); cut(x, y);
      });
      doc.addPage("a4", "portrait");
      chunk.forEach((e, k) => {
        const c = cols - 1 - (k % cols), r = Math.floor(k / cols); // mirrored for duplex
        const x = ox + c * (W + gap), y = oy + r * (H + gap);
        back(doc, x, y, e, iss); cut(x, y);
      });
    }
  }
  const name = employees.length === 1 ? `ID card ${employees[0].employee_code}` : `ID cards (${employees.length})`;
  doc.save(`${name}${layout === "a4" ? " A4" : ""}.pdf`);
  return photos.filter((p) => !p).length; // how many printed without a photo
}

/** Shrinks a picked photo to ≤ 900 px on the long side, as JPEG. */
export async function preparePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const r = Math.min(1, 900 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.9));
  } finally { URL.revokeObjectURL(url); }
}
