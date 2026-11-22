// Builds the book's PDF and ZIP and the series' bundle images in the browser.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { PAGE_SIZES, slugify, type PageSize } from "@/lib/books";

interface ExportPage {
  position: number;
  kind: string;
  title: string;
  content: string;
  imageUrl: string | null;
}
interface ExportThumbnail {
  slot: number;
  imageUrl: string | null;
}
export interface ExportListing {
  title: string;
  description: string;
  grades: string;
  subjects: string;
  tags: string[];
  priceCents: number | null;
}

async function loadImage(
  url: string,
): Promise<{ bytes: Uint8Array; type: "png" | "jpg" }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("An image couldn't be loaded. Try again.");
  const type = response.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (type === "image/png") return { bytes, type: "png" };
  if (type === "image/jpeg") return { bytes, type: "jpg" };
  // Anything else (WebP) becomes a PNG, which every PDF reader shows.
  const bitmap = await createImageBitmap(new Blob([bytes], { type }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion failed"))),
      "image/png",
    ),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png" };
}

/** The standard PDF font covers Latin-1; other characters become close equivalents. */
function printable(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of printable(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export async function buildPdf(pageSize: PageSize, pages: ExportPage[]) {
  const { width, height } = PAGE_SIZES[pageSize];
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  for (const page of pages) {
    const sheet = pdf.addPage([width, height]);
    if (page.imageUrl) {
      const image = await loadImage(page.imageUrl);
      const embedded =
        image.type === "png"
          ? await pdf.embedPng(image.bytes)
          : await pdf.embedJpg(image.bytes);
      const scale = Math.min(
        (width - margin * 2) / embedded.width,
        (height - margin * 2) / embedded.height,
      );
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      sheet.drawImage(embedded, {
        x: (width - w) / 2,
        y: (height - h) / 2,
        width: w,
        height: h,
      });
      continue;
    }
    let y = height - margin - 24;
    for (const line of wrap(page.title, bold, 22, width - margin * 2)) {
      sheet.drawText(line, {
        x: margin,
        y,
        size: 22,
        font: bold,
        color: rgb(0, 0, 0),
      });
      y -= 30;
    }
    y -= 10;
    for (const line of wrap(page.content, font, 13, width - margin * 2)) {
      if (y < margin) break;
      sheet.drawText(line, {
        x: margin,
        y,
        size: 13,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 19;
    }
  }
  return pdf.save({ useObjectStreams: false });
}

export function listingText(listing: ExportListing | null) {
  if (!listing) return "";
  return [
    `Title: ${listing.title}`,
    `Grades: ${listing.grades}`,
    `Subjects: ${listing.subjects}`,
    `Tags: ${listing.tags.join(", ")}`,
    `Price: ${listing.priceCents === null ? "" : `$${(listing.priceCents / 100).toFixed(2)}`}`,
    "",
    listing.description,
    "",
  ].join("\n");
}

export async function buildZip(book: {
  title: string;
  pageSize: PageSize;
  pages: ExportPage[];
  thumbnails: ExportThumbnail[];
  listing: ExportListing | null;
}) {
  const slug = slugify(book.title);
  const files: Record<string, Uint8Array> = {};
  for (const [index, page] of book.pages.entries()) {
    if (!page.imageUrl) continue;
    const image = await loadImage(page.imageUrl);
    files[
      `pages/${String(index + 1).padStart(2, "0")}-${slugify(page.title)}.${image.type}`
    ] = image.bytes;
  }
  for (const thumb of book.thumbnails) {
    if (!thumb.imageUrl) continue;
    const image = await loadImage(thumb.imageUrl);
    files[`thumbnails/thumbnail-${thumb.slot}.${image.type}`] = image.bytes;
  }
  files[`${slug}.pdf`] = await buildPdf(book.pageSize, book.pages);
  files["listing.txt"] = strToU8(listingText(book.listing));
  return zipSync(files, { level: 6 });
}

export async function buildBundleZip(bundle: {
  title: string;
  description: string;
  tags: string[];
  imageUrls: string[];
}) {
  const files: Record<string, Uint8Array> = {};
  for (const [index, url] of bundle.imageUrls.entries()) {
    const image = await loadImage(url);
    files[`images/bundle-${index + 1}.${image.type}`] = image.bytes;
  }
  files["listing.txt"] = strToU8(
    [
      `Title: ${bundle.title}`,
      `Tags: ${bundle.tags.join(", ")}`,
      "",
      bundle.description,
      "",
    ].join("\n"),
  );
  return zipSync(files, { level: 6 });
}

export function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("The file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

// Bundle images: square, composed from the books' covers and pages.
interface BundleBook {
  title: string;
  pageCount: number;
  coverUrl: string | null;
  pageUrls: string[];
}

function loadElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image couldn't be loaded."));
    image.src = url;
  });
}

const SIZE = 1200;
const INK = "#1f2937";
const PAPER = "#ffffff";
const BACKDROP = "#f3f4f6";

function card(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (image) {
    const scale = Math.min(w / image.width, h / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(w / 9)}px sans-serif`;
    ctx.textAlign = "center";
    words(ctx, title, x + w / 2, y + h / 2, w - 24, Math.round(w / 7.5));
  }
}

function words(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  width: number,
  lineHeight: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  const top = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, top + i * lineHeight));
}

function canvas() {
  const element = document.createElement("canvas");
  element.width = SIZE;
  element.height = SIZE;
  const ctx = element.getContext("2d")!;
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.textBaseline = "middle";
  return { element, ctx };
}

function heading(ctx: CanvasRenderingContext2D, text: string, y = 90) {
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 64px sans-serif";
  words(ctx, text, SIZE / 2, y, SIZE - 120, 72);
}

export async function composeBundleImages(title: string, books: BundleBook[]) {
  const covers = await Promise.all(
    books.map((b) =>
      b.coverUrl ? loadElement(b.coverUrl) : Promise.resolve(null),
    ),
  );
  const insides = await Promise.all(
    books.map((b) =>
      b.pageUrls[0] ? loadElement(b.pageUrls[0]) : Promise.resolve(null),
    ),
  );
  const out: string[] = [];
  const n = books.length;

  // 1. Every cover in a grid under the bundle's title.
  {
    const { element, ctx } = canvas();
    heading(ctx, title);
    const cols = n <= 2 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const w = (SIZE - 120 - (cols - 1) * 40) / cols;
    const h = Math.min(w * 1.3, (SIZE - 240 - (rows - 1) * 40) / rows);
    books.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const offset = (SIZE - (inRow * w + (inRow - 1) * 40)) / 2;
      card(
        ctx,
        covers[i]!,
        b.title,
        offset + col * (w + 40),
        200 + row * (h + 40),
        w,
        h,
      );
    });
    out.push(element.toDataURL("image/png"));
  }
  // 2. Covers fanned out in a row.
  {
    const { element, ctx } = canvas();
    const w = 420;
    const h = 546;
    const step = n > 1 ? (SIZE - 160 - w) / (n - 1) : 0;
    books.forEach((b, i) => {
      ctx.save();
      const x = 80 + i * step + w / 2;
      const y = SIZE / 2 + 60;
      ctx.translate(x, y);
      ctx.rotate(((i - (n - 1) / 2) * 6 * Math.PI) / 180);
      card(ctx, covers[i]!, b.title, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
    heading(ctx, `${n} books in one bundle`);
    out.push(element.toDataURL("image/png"));
  }
  // 3. A page from inside each book.
  {
    const { element, ctx } = canvas();
    heading(ctx, "Inside the books");
    const cols = n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const w = (SIZE - 120 - (cols - 1) * 30) / cols;
    const h = Math.min(w * 1.3, (SIZE - 220 - (rows - 1) * 30) / rows);
    books.forEach((b, i) => {
      card(
        ctx,
        insides[i] ?? covers[i]!,
        b.title,
        60 + (i % cols) * (w + 30),
        190 + Math.floor(i / cols) * (h + 30),
        w,
        h,
      );
    });
    out.push(element.toDataURL("image/png"));
  }
  // 4. What's included: each book with its page count.
  {
    const { element, ctx } = canvas();
    heading(ctx, "What's included");
    const rowH = Math.min(150, (SIZE - 220) / n);
    books.forEach((b, i) => {
      const y = 190 + i * rowH;
      card(ctx, covers[i]!, b.title, 100, y, rowH * 0.75, rowH - 16);
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.font = `600 ${Math.round(rowH / 4)}px sans-serif`;
      ctx.fillText(
        b.title,
        100 + rowH * 0.75 + 40,
        y + rowH / 2 - 20,
        SIZE - 300 - rowH,
      );
      ctx.font = `400 ${Math.round(rowH / 5.5)}px sans-serif`;
      ctx.fillText(
        `${b.pageCount} printable pages`,
        100 + rowH * 0.75 + 40,
        y + rowH / 2 + 20,
      );
    });
    out.push(element.toDataURL("image/png"));
  }
  return out.map((url) => url.split(",")[1]!);
}
