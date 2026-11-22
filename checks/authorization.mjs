// Authorization: the Gateway's perimeter, ownership of every object, the
// admin-only page, and no sign-in of the app's own.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeAiGateway, choose, replay, isServerFn } from "./lib.mjs";

const runtime = await startRuntime(fakeAiGateway());
try {
  await runtime.assertPrivateAccess([
    "/",
    "/ideas",
    "/series",
    "/books/new",
    "/admin",
    "/health",
  ]);

  // No sign-in, sign-up or sign-out page of the app's own.
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/register",
    "/logout",
    "/account",
    "/password",
  ]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status, path).toBe(404);
    expect(await response.text()).not.toMatch(/type="password"/);
  }

  // The owner makes a book, plans it and draws its cover, and a series.
  const owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/books/new");
  await owner.getByLabel("Title").fill("Owner Ocean Animals");
  await owner.getByLabel("Details").fill("Ocean animal tracing pages");
  await choose(owner, "grade", "Grades 1–2");
  await owner.getByLabel("Pages").fill("5");
  await owner.getByRole("button", { name: "Create book" }).click();
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText(
    "Owner Ocean Animals",
  );
  const bookPath = new URL(owner.url()).pathname;
  const bookId = bookPath.split("/").pop();
  await owner.getByRole("button", { name: "Plan pages" }).click();
  await expect(owner.getByTestId("page-row")).toHaveCount(5);
  await owner
    .getByTestId("page-row")
    .first()
    .getByRole("button", { name: "Draw" })
    .click();
  await expect(
    owner.getByTestId("page-row").first().locator("img"),
  ).toHaveCount(1);
  const imagePath = await owner
    .getByTestId("page-row")
    .first()
    .locator("img")
    .getAttribute("src");
  expect((await runtime.fetch(imagePath, { role: "owner" })).status).toBe(200);

  // Capture the owner's own rename and page-delete calls to replay as others.
  await owner.getByRole("button", { name: "Edit book" }).click();
  await owner
    .getByRole("dialog")
    .getByLabel("Title")
    .fill("Owner Ocean Animals Vol 1");
  const [rename] = await Promise.all([
    owner.waitForRequest(isServerFn),
    owner.getByRole("dialog").getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText(
    "Owner Ocean Animals Vol 1",
  );
  await owner.reload();
  await expect(owner.getByTestId("page-row")).toHaveCount(5);

  await owner.goto("/ideas");
  await owner.getByLabel("Keyword").fill("ocean");
  await owner.getByRole("button", { name: "Suggest ideas" }).click();
  await expect(owner.getByTestId("idea-card")).toHaveCount(3);
  await owner
    .getByTestId("idea-card")
    .first()
    .getByRole("button", { name: "Plan a series" })
    .click();
  await owner.getByRole("dialog").getByLabel("Number of books").fill("2");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Create series" })
    .click();
  await expect(owner).toHaveURL(/\/series\//);
  const seriesPath = new URL(owner.url()).pathname;

  // Another member sees none of it.
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/");
  await expect(
    member.getByRole("heading", { level: 1, name: "Books" }),
  ).toBeVisible();
  await expect(member.getByTestId("book-row")).toHaveCount(0);
  await expect(member.getByText("Owner Ocean Animals")).toHaveCount(0);
  await member.goto(bookPath);
  await expect(member.getByText("Book not found")).toBeVisible();
  await expect(member.getByText("Owner Ocean Animals")).toHaveCount(0);
  await member.goto(seriesPath);
  await expect(member.getByText("Series not found")).toBeVisible();
  await member.goto("/ideas");
  await expect(member.getByTestId("idea-card")).toHaveCount(0);
  await member.goto("/series");
  await expect(member.getByTestId("series-row")).toHaveCount(0);

  // Nor its images, whoever asks.
  expect((await runtime.fetch(imagePath, { role: "member" })).status).toBe(404);
  expect([401, 403]).toContain(
    (await runtime.fetch(imagePath, { role: "outsider" })).status,
  );
  expect([401, 403, 302]).toContain((await runtime.fetch(imagePath)).status);

  // Replaying the owner's rename as the member changes nothing.
  const replayed = await replay(runtime, rename, "member");
  // Server functions answer a refusal as a serialized error.
  expect(await replayed.text()).toContain("Book not found");
  const db = await runtime.database();
  const row = await db
    .prepare("SELECT title FROM books WHERE id = ?")
    .bind(bookId)
    .first();
  expect(row.title).toBe("Owner Ocean Animals Vol 1");
  expect([401, 403]).toContain(
    (await replay(runtime, rename, "outsider")).status,
  );

  // The member's own book stays theirs.
  await member.goto("/books/new");
  await member.getByLabel("Title").fill("Member Farm Friends");
  await member.getByLabel("Details").fill("Farm animal counting");
  await member.getByRole("button", { name: "Create book" }).click();
  await expect(member.getByRole("heading", { level: 1 })).toHaveText(
    "Member Farm Friends",
  );
  const memberBookPath = new URL(member.url()).pathname;
  await owner.goto(memberBookPath);
  await expect(owner.getByText("Book not found")).toBeVisible();

  // Admin-only: the member is refused the list of everyone's books, the owner (an admin) gets it.
  await member.goto("/admin");
  await expect(
    member.getByText("Only admins can open this page."),
  ).toBeVisible();
  await expect(member.getByTestId("admin-book-row")).toHaveCount(0);
  await owner.goto("/admin");
  const [adminList] = await Promise.all([
    owner.waitForRequest((request) => request.url().includes("/_serverFn/")),
    owner.getByRole("button", { name: "Refresh" }).click(),
  ]);
  await expect(owner.getByTestId("admin-book-row")).toHaveCount(4);
  await expect(
    owner
      .getByTestId("admin-book-row")
      .filter({ hasText: "Member Farm Friends" }),
  ).toContainText("member@example.test");
  const memberAdminList = await replay(runtime, adminList, "member");
  const memberAdminText = await memberAdminList.text();
  expect(memberAdminText).toContain("Only admins can do this.");
  expect(memberAdminText).not.toContain("Owner Ocean Animals");
  const [adminDelete] = await Promise.all([
    owner.waitForRequest(isServerFn),
    (async () => {
      await owner
        .getByTestId("admin-book-row")
        .filter({ hasText: "Member Farm Friends" })
        .getByRole("button", { name: "Delete" })
        .click();
      await owner
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();
    })(),
  ]);
  await expect(owner.getByTestId("admin-book-row")).toHaveCount(3);
  await member.goto("/");
  await expect(member.getByTestId("book-row")).toHaveCount(0);
  // A non-admin replaying the admin delete, aimed at the owner's book, is refused.
  const deletedId = (
    await db
      .prepare(
        "SELECT count(*) AS n FROM books WHERE title = 'Member Farm Friends'",
      )
      .first()
  ).n;
  expect(deletedId).toBe(0);
  const aimed = await replay(runtime, adminDelete, "member", (body) =>
    body.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      bookId,
    ),
  );
  expect(await aimed.text()).toContain("Only admins can do this.");
  const stillThere = await db
    .prepare("SELECT count(*) AS n FROM books WHERE id = ?")
    .bind(bookId)
    .first();
  expect(stillThere.n).toBe(1);
} finally {
  await runtime.close();
}
