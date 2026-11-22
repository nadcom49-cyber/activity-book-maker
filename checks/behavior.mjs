// Behavior: every frozen feature's main path, through the browser and the
// app's file route, against the packaged release with a local fake model.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  fakeAiGateway,
  readZip,
  downloadBytes,
  choose,
  makePng,
} from "./lib.mjs";

const runtime = await startRuntime(fakeAiGateway());
try {
  const page = await (await runtime.context("owner")).newPage();

  // F002: niche ideas from a keyword, saved to history.
  await page.goto("/ideas");
  await runtime.assertBackLink(page);
  await page.getByLabel("Keyword").fill("fractions");
  await page.getByRole("button", { name: "Suggest ideas" }).click();
  const ideas = page.getByTestId("idea-card");
  await expect(ideas).toHaveCount(3);
  await expect(ideas.first()).toContainText("Fraction Pizza Party");
  await expect(ideas.first()).toContainText("10 pages");
  await expect(ideas.first()).toContainText("Steady demand");
  await page.reload();
  await expect(page.getByTestId("idea-card")).toHaveCount(3);

  // F002 -> F001: using an idea prefills a new book.
  await page
    .getByTestId("idea-card")
    .first()
    .getByRole("link", { name: "Start a book" })
    .click();
  await expect(page).toHaveURL(/\/books\/new/);
  await expect(page.getByLabel("Title")).toHaveValue("Fraction Pizza Party");
  await expect(page.getByLabel("Pages")).toHaveValue("10");
  await choose(page, "grade", "Grades 3–5");
  await choose(page, "subject", "Math");
  await choose(page, "language", "English");
  await choose(page, "page-size", "US Letter");
  await page.getByLabel("Pages").fill("8");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fraction Pizza Party",
  );
  await expect(page.getByTestId("book-status")).toHaveText("Draft");
  const bookUrl = page.url();
  const bookId = bookUrl.split("/books/")[1];

  // F001: a book from its own idea, listed with its status, renamed, deleted.
  await page.goto("/books/new");
  await choose(page, "source-kind", "My own idea");
  await page
    .getByLabel("Details")
    .fill("Spring vocabulary puzzles for early readers");
  await page.getByLabel("Title").fill("Spring Word Puzzles");
  await choose(page, "language", "Spanish");
  await choose(page, "page-size", "A4");
  await page.getByLabel("Pages").fill("17");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.getByText("16 pages at most")).toBeVisible();
  await page.getByLabel("Pages").fill("6");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Spring Word Puzzles",
  );
  await page.getByRole("button", { name: "Edit book" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Spring Word Search");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Spring Word Search",
  );
  await page.goto("/");
  const rows = page.getByTestId("book-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Spring Word Search" })).toContainText(
    "Spanish",
  );
  await expect(
    rows.filter({ hasText: "Fraction Pizza Party" }).getByTestId("book-status"),
  ).toHaveText("Draft");
  await rows
    .filter({ hasText: "Spring Word Search" })
    .getByRole("link")
    .first()
    .click();
  await page.getByRole("button", { name: "Delete book" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/$|\/books$/);
  await expect(page.getByTestId("book-row")).toHaveCount(1);

  // F003: the page plan, edited, reordered, added to and trimmed.
  await page.goto(bookUrl);
  await page.getByRole("button", { name: "Plan pages" }).click();
  const pageRows = page.getByTestId("page-row");
  await expect(pageRows).toHaveCount(8);
  await expect(page.getByTestId("book-status")).toHaveText("Planned");
  await expect(pageRows.first()).toContainText("Cover");
  await expect(pageRows.nth(1)).toContainText("Teacher");
  await expect(pageRows.nth(6)).toContainText("Answer key");
  await expect(pageRows.last()).toContainText("Thank you");
  await pageRows.nth(2).getByRole("button", { name: "Edit page" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title").fill("Shade the pizza halves");
  await editor
    .getByLabel("Text")
    .fill("Shade one half of each pizza. Then write 1/2 under it.");
  await editor
    .getByLabel("Illustration prompt")
    .fill("Line art of six round pizzas, each cut in two");
  await editor.getByRole("button", { name: "Save page" }).click();
  await expect(pageRows.nth(2)).toContainText("Shade the pizza halves");
  await pageRows.nth(3).getByRole("button", { name: "Move up" }).click();
  await expect(pageRows.nth(2).getByTestId("page-title")).not.toHaveText(
    "Shade the pizza halves",
  );
  await expect(pageRows.nth(3).getByTestId("page-title")).toHaveText(
    "Shade the pizza halves",
  );
  await page.getByRole("button", { name: "Add page" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title")
    .fill("Bonus: pizza coloring");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save page" })
    .click();
  await expect(pageRows).toHaveCount(9);
  await pageRows.last().getByRole("button", { name: "Delete page" }).click();
  await expect(pageRows).toHaveCount(8);
  await page.reload();
  await expect(
    page.getByTestId("page-row").nth(3).getByTestId("page-title"),
  ).toHaveText("Shade the pizza halves");

  // F004: every page and the four thumbnails drawn in sequence with progress.
  await page.getByRole("button", { name: "Draw all" }).click();
  await expect(page.getByTestId("draw-progress")).toBeVisible();
  await expect(page.getByTestId("book-status")).toHaveText("Ready", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("page-row").locator("img")).toHaveCount(8);
  const src = await page
    .getByTestId("page-row")
    .first()
    .locator("img")
    .getAttribute("src");
  expect(src).toMatch(new RegExp(`^/files/${bookId}/`));
  const image = await runtime.fetch(src, { role: "owner" });
  expect(image.status).toBe(200);
  expect(image.headers.get("content-type")).toBe("image/png");

  // F004: redraw one page with a note, replace another with an upload.
  await page
    .getByTestId("page-row")
    .nth(2)
    .getByRole("button", { name: "Redraw" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Note")
    .fill("Bigger slices, thicker lines");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Redraw page" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const before = await page
    .getByTestId("page-row")
    .nth(4)
    .locator("img")
    .getAttribute("src");
  await page
    .getByTestId("page-row")
    .nth(4)
    .getByTestId("page-upload-input")
    .setInputFiles({
      name: "my-page.png",
      mimeType: "image/png",
      buffer: makePng(60, 80, [
        [250, 250, 250],
        [200, 220, 255],
        [20, 20, 120],
      ]),
    });
  await expect(
    page.getByTestId("page-row").nth(4).locator("img"),
  ).not.toHaveAttribute("src", before);
  await page.getByRole("tab", { name: "Thumbnails" }).click();
  await expect(page.getByTestId("thumbnail").locator("img")).toHaveCount(4);

  // F006: listing written, edited, saved, copied.
  await page.getByRole("tab", { name: "Listing" }).click();
  await page.getByRole("button", { name: "Write listing" }).click();
  await expect(page.getByLabel("Listing title")).toHaveValue(
    "Fraction Pizza Party | Printable Fraction Worksheets",
  );
  await expect(page.getByLabel("Tags", { exact: true })).toHaveValue(
    "fractions, math centers, printable worksheets",
  );
  await expect(page.getByLabel("Price (USD)", { exact: true })).toHaveValue(
    "4.50",
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Eight printable pages of pizza fraction practice, with answer keys.",
    );
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(page.getByText("Listing saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy title" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Listing" }).click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Eight printable pages of pizza fraction practice, with answer keys.",
  );

  // F005: flip through, then download the PDF and the ZIP.
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("preview-counter")).toHaveText("Page 1 of 8");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("preview-counter")).toHaveText("Page 2 of 8");
  await expect(page.getByTestId("preview-page").locator("img")).toBeVisible();
  await expect(
    page.getByTestId("preview-thumbnails").locator("img"),
  ).toHaveCount(4);
  const pdf = await downloadBytes(page, () =>
    page.getByRole("button", { name: "Download PDF" }).click(),
  );
  expect(pdf.name).toMatch(/\.pdf$/);
  const pdfText = pdf.bytes.toString("latin1");
  expect(pdfText.startsWith("%PDF")).toBe(true);
  expect(pdfText.match(/\/Type \/Page(?!s)/g)?.length).toBe(8);
  expect(pdfText).toMatch(/\/MediaBox \[\s*0 0 612 792\s*\]/);
  const zip = await downloadBytes(page, () =>
    page.getByRole("button", { name: "Download ZIP" }).click(),
  );
  const entries = readZip(zip.bytes);
  const names = [...entries.keys()];
  expect(names.filter((n) => /^pages\/.+\.png$/.test(n))).toHaveLength(8);
  expect(names.filter((n) => /^thumbnails\/.+\.png$/.test(n))).toHaveLength(4);
  expect(names.filter((n) => n.endsWith(".pdf"))).toHaveLength(1);
  expect(entries.get("listing.txt").toString("utf8")).toContain(
    "Eight printable pages of pizza fraction practice",
  );

  // F002 -> F007: a niche planned as a series, then bundled.
  await page.goto("/ideas");
  await page
    .getByTestId("idea-card")
    .first()
    .getByRole("button", { name: "Plan a series" })
    .click();
  await page.getByRole("dialog").getByLabel("Number of books").fill("7");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create series" })
    .click();
  await expect(page.getByText("2 to 6 books")).toBeVisible();
  await page.getByRole("dialog").getByLabel("Number of books").fill("3");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create series" })
    .click();
  await expect(page).toHaveURL(/\/series\//);
  await expect(page.getByTestId("series-book")).toHaveCount(3);
  await choose(page, "add-book", "Fraction Pizza Party");
  await page.getByRole("button", { name: "Add to series" }).click();
  await expect(page.getByTestId("series-book")).toHaveCount(4);
  await page.getByRole("button", { name: "Write bundle listing" }).click();
  await expect(page.getByLabel("Bundle title")).toHaveValue(
    "Fraction Pizza Bundle (4 books)",
  );
  await page.getByRole("button", { name: "Save bundle listing" }).click();
  await expect(page.getByText("Bundle listing saved")).toBeVisible();
  await page.getByRole("button", { name: "Make bundle images" }).click();
  await expect(page.getByTestId("bundle-image").locator("img")).toHaveCount(4);
  const bundle = await downloadBytes(page, () =>
    page.getByRole("button", { name: "Download bundle ZIP" }).click(),
  );
  const bundleEntries = [...readZip(bundle.bytes).keys()];
  expect(bundleEntries.filter((n) => /^images\/.+\.png$/.test(n))).toHaveLength(
    4,
  );
  expect(bundleEntries).toContain("listing.txt");
  await page.goto("/series");
  await expect(page.getByTestId("series-row")).toHaveCount(1);
  await expect(page.getByTestId("series-row")).toContainText("4 books");
  // Series books show on the book list too, as drafts.
  await page.goto("/");
  await expect(page.getByTestId("book-row")).toHaveCount(4);

  // The finished book on screen: the public picture.
  await page.goto(bookUrl);
  await expect(page.getByTestId("page-row").locator("img")).toHaveCount(8);
  await runtime.screenshot(page);

  // Phone-sized smoke.
  const phone = await (
    await runtime.context("member", {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await phone.goto("/");
  await expect(
    phone.getByRole("heading", { level: 1, name: "Books" }),
  ).toBeVisible();
  await expect(phone.getByRole("link", { name: "New book" })).toBeVisible();
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
} finally {
  await runtime.close();
}
