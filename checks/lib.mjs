// Shared helpers for the suites: a local fake of the AI provider behind the
// Gateway's binding, picture bytes for it to return, and a ZIP reader.
import { deflateSync, inflateRawSync, crc32 } from "node:zlib";

/** A small PNG: a soft two-colour gradient with a circle, so drawn pages look drawn. */
export function makePng(width, height, [a, b, c]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const t = (x + y) / (width + height);
      const dx = x - width / 2,
        dy = y - height / 2.2;
      const inCircle = dx * dx + dy * dy < (Math.min(width, height) / 4) ** 2;
      const px = row + 1 + x * 3;
      for (let i = 0; i < 3; i++) {
        raw[px + i] = inCircle ? c[i] : Math.round(a[i] * (1 - t) + b[i] * t);
      }
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PALETTES = [
  [
    [255, 236, 210],
    [252, 182, 159],
    [94, 129, 172],
  ],
  [
    [220, 245, 230],
    [150, 210, 190],
    [242, 153, 74],
  ],
  [
    [230, 230, 255],
    [180, 190, 240],
    [235, 87, 87],
  ],
  [
    [255, 250, 220],
    [250, 215, 120],
    [39, 174, 96],
  ],
];

/**
 * A Worker that answers the app's model calls the way an OpenAI-compatible
 * provider would, keyed by the "Task: <name>" line the app's prompts start
 * with. Every other capability call is refused as an unconfigured Gateway does.
 */
export function fakeAiGateway() {
  const pictures = PALETTES.map((p) => makePng(96, 120, p).toString("base64"));
  const script = `
const PICTURES = ${JSON.stringify(pictures)};
let drawn = 0;
const calls = [];
function reply(content) {
  return Response.json({ id: "fake", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] });
}
const KINDS = (n) => {
  const kinds = ["cover", "teacher"];
  const activities = Math.max(1, n - 4);
  for (let i = 0; i < activities; i++) kinds.push("activity");
  kinds.push("answer_key", "thank_you");
  return kinds.slice(0, n);
};
const ANSWERS = {
  niches: (input) => ({ ideas: [
    { title: "Fraction Pizza Party", angle: "Halves, thirds and quarters shown as pizza slices", suggestedPages: 10, demand: "Steady demand from 3rd grade teachers each spring." },
    { title: "Fraction Number Line Missions", angle: "Placing fractions on number lines with a space theme", suggestedPages: 12, demand: "Popular with homeschool families." },
    { title: "Equivalent Fractions Bakery", angle: "Matching equivalent fractions with bakery trays", suggestedPages: 8, demand: "Fewer sellers, good for a first book." },
  ].map((idea) => ({ ...idea, title: idea.title + (input.keyword && !/fraction/i.test(input.keyword) ? " (" + input.keyword + ")" : "") })) }),
  plan: (input) => ({
    pages: KINDS(input.pageCount).map((kind, i) => ({
      kind,
      title: kind === "cover" ? input.title : kind === "teacher" ? "How to use this book" : kind === "answer_key" ? "Answer key" : kind === "thank_you" ? "Thank you" : "Activity " + i + ": " + ["Shade the halves", "Color the thirds", "Match the slices", "Fraction maze", "Pizza word problems", "Cut and paste", "Compare fractions", "Make your own pizza", "Fraction bingo", "Count the toppings", "Fraction riddles", "Draw the fraction"][(i - 2) % 12],
      content: kind === "activity" ? "Look at each pizza. Shade the slices that show the fraction written below it." : kind === "teacher" ? "Print one page per student. Activities go from easy to hard." : kind === "answer_key" ? "1) 1/2  2) 1/3  3) 3/4" : kind === "thank_you" ? "Thanks for teaching with this book!" : "A fraction activity book for young learners.",
      imagePrompt: "Black and white line art, " + kind + " page, friendly pizza slices",
    })),
    thumbnails: ["Cover on a desk with crayons", "Two activity pages side by side", "Answer key preview", "What is inside: page count and grade"],
  }),
  listing: (input) => ({ title: input.title + " | Printable Fraction Worksheets", description: "A printable fraction activity book with answer keys.", grades: "3rd, 4th", subjects: "Math, Fractions", tags: ["fractions", "math centers", "printable worksheets"], price: 4.5 }),
  series: (input) => ({ books: Array.from({ length: input.count }, (_, i) => ({ title: ["Fraction Pizza Party", "Fraction Pizza Party: Thirds", "Fraction Pizza Party: Quarters", "Fraction Pizza Party: Mixed", "Fraction Pizza Party: Review", "Fraction Pizza Party: Challenge"][i], idea: "Book " + (i + 1) + " of the pizza fractions series" })) }),
  bundle: (input) => ({ title: "Fraction Pizza Bundle (" + input.books.length + " books)", description: "Every pizza fractions book in one bundle.", tags: ["fractions bundle", "math bundle"] }),
};
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/__calls") return Response.json(calls);
  const body = request.method === "POST" ? await request.json().catch(() => null) : null;
  calls.push({ path: url.pathname, model: body && body.model });
  if (url.pathname !== "/api/ai/openrouter/api/v1/chat/completions" || !body) {
    return Response.json({ error: "Service Unavailable", code: "integration_not_configured", message: "Not configured here." }, { status: 503, headers: { "x-everyapp-error": "integration_not_configured" } });
  }
  if (Array.isArray(body.modalities) && body.modalities.includes("image")) {
    const png = PICTURES[drawn++ % PICTURES.length];
    return Response.json({ choices: [{ index: 0, message: { role: "assistant", content: "", images: [{ type: "image_url", image_url: { url: "data:image/png;base64," + png } }] } }] });
  }
  const system = body.messages.find((m) => m.role === "system")?.content ?? "";
  const task = /Task: (\\w+)/.exec(system)?.[1];
  const input = JSON.parse(body.messages.find((m) => m.role === "user")?.content ?? "{}");
  const answer = ANSWERS[task];
  if (!answer) return Response.json({ error: { message: "unknown task " + task } }, { status: 400 });
  return reply(JSON.stringify(answer(input)));
} };`;
  return {
    workers: [
      {
        config: {
          name: "fake-ai-gateway",
          compatibilityDate: "2026-06-01",
          manifest: {
            mainModule: "fake.mjs",
            modules: { "fake.mjs": { type: "esm", contents: script } },
          },
        },
      },
    ],
    bindings: {
      EVERY_APP_GATEWAY: { type: "worker", worker: "fake-ai-gateway" },
    },
  };
}

/** The entries of a ZIP archive: name to bytes. */
export function readZip(buffer) {
  const entries = new Map();
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Not a ZIP archive");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28),
      extra = buffer.readUInt16LE(at + 30),
      comment = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer
      .subarray(at + 46, at + 46 + nameLength)
      .toString("utf8");
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    entries.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

export async function downloadBytes(page, trigger) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    trigger(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

/** Picks an option in a Base UI select by its trigger's test id. */
export async function choose(page, testId, optionName) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

/** Replays a captured server-function request as another role. */
export function replay(runtime, request, role, edit = (body) => body) {
  const url = new URL(request.url());
  const headers = { ...request.headers() };
  for (const name of Object.keys(headers)) {
    if (
      /^(cookie|host|content-length|authorization|origin|referer|sec-|x-everyapp)/i.test(
        name,
      )
    )
      delete headers[name];
  }
  return runtime.fetch(url.pathname + url.search, {
    role,
    method: request.method(),
    headers,
    body: request.postData() == null ? undefined : edit(request.postData()),
  });
}

export const isServerFn = (request) =>
  request.url().includes("/_serverFn/") && request.method() === "POST";
