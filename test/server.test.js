const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../server");

test("API persists transactions and budgets and rejects invalid input", async (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "expense-tracker-"));
  const server = createApp(dataDirectory).listen(0);
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options) => fetch(`${baseUrl}${url}`, options);
  const json = (body) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const page = await request("/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Expense Tracker/);
  assert.equal((await request("/data/expense-data.json")).status, 404);

  const initial = await request("/api/state").then((response) => response.json());
  assert.deepEqual(initial.items, []);
  assert.equal(initial.budgets.Food, 3000);

  const invalid = await request("/api/transactions", {
    method: "POST",
    ...json({ type: "expense", desc: "Lunch", amount: 20, cat: "Salary", date: "2026-02-31" }),
  });
  assert.equal(invalid.status, 400);

  const createdResponse = await request("/api/transactions", {
    method: "POST",
    ...json({ type: "expense", desc: "Lunch", amount: 20.25, cat: "Food", date: "2026-11-25" }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.amount, 20.25);

  const budgetResponse = await request("/api/budgets", {
    method: "PUT",
    ...json({ category: "Food", amount: 1250 }),
  });
  assert.equal((await budgetResponse.json()).budgets.Food, 1250);

  const persisted = await request("/api/state").then((response) => response.json());
  assert.equal(persisted.items[0].id, created.id);
  assert.equal(persisted.budgets.Food, 1250);

  const deleted = await request(`/api/transactions/${created.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  const afterDelete = await request("/api/state").then((response) => response.json());
  assert.deepEqual(afterDelete.items, []);
});
