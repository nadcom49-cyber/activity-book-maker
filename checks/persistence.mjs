// Persistence: a book, its pages, its uploaded image and its listing survive a restart.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { makePng } from "./lib.mjs";

const runtime = await startRuntime();
try {
  let page = await (await runtime.context("member")).newPage();
  await page.goto("/books/new");
  await page.getByLabel("Title").fill("Rainforest Coloring Pages");
  await page.getByLabel("Details").fill("Toucans, frogs and sloths to color");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Rainforest Coloring Pages",
  );
  const bookPath = new URL(page.url()).pathname;

  // Without a model the plan is written by hand.
  await page.getByRole("button", { name: "Add page" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Color the toucan");
  await page
    .getByRole("dialog")
    .getByLabel("Text")
    .fill("Use bright colors for the beak.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save page" })
    .click();
  await expect(page.getByTestId("page-row")).toHaveCount(1);
  await page
    .getByTestId("page-row")
    .first()
    .getByTestId("page-upload-input")
    .setInputFiles({
      name: "toucan.png",
      mimeType: "image/png",
      buffer: makePng(60, 80, [
        [255, 255, 255],
        [230, 240, 200],
        [240, 120, 20],
      ]),
    });
  await expect(page.getByTestId("page-row").first().locator("img")).toHaveCount(
    1,
  );
  const imagePath = await page
    .getByTestId("page-row")
    .first()
    .locator("img")
    .getAttribute("src");

  await page.getByRole("tab", { name: "Listing" }).click();
  await page
    .getByLabel("Listing title")
    .fill("Rainforest Animals Coloring Book");
  await page
    .getByLabel("Tags", { exact: true })
    .fill("rainforest, coloring, animals");
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(page.getByText("Listing saved")).toBeVisible();

  await runtime.restart();

  page = await (await runtime.context("member")).newPage();
  await page.goto("/");
  await expect(
    page
      .getByTestId("book-row")
      .filter({ hasText: "Rainforest Coloring Pages" }),
  ).toHaveCount(1);
  await page.goto(bookPath);
  await expect(page.getByTestId("page-row").first()).toContainText(
    "Color the toucan",
  );
  await expect(
    page.getByTestId("page-row").first().locator("img"),
  ).toHaveAttribute("src", imagePath);
  const image = await runtime.fetch(imagePath, { role: "member" });
  expect(image.status).toBe(200);
  expect(
    Buffer.from(await image.arrayBuffer())
      .subarray(1, 4)
      .toString(),
  ).toBe("PNG");
  await page.getByRole("tab", { name: "Listing" }).click();
  await expect(page.getByLabel("Listing title")).toHaveValue(
    "Rainforest Animals Coloring Book",
  );
  await expect(page.getByLabel("Tags", { exact: true })).toHaveValue(
    "rainforest, coloring, animals",
  );
} finally {
  await runtime.close();
}
