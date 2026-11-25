const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const categories = {
  expense: ["Food", "Travel", "Shopping", "Bills", "Education", "Entertainment", "Other"],
  income: ["Pocket money", "Salary", "Scholarship", "Other income"],
};
const defaultBudgets = {
  Food: 3000,
  Travel: 1500,
  Shopping: 2000,
  Bills: 1500,
  Education: 2000,
  Entertainment: 1000,
  Other: 1000,
};

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function createApp(dataDirectory = process.env.DATA_DIR || path.join(__dirname, "data")) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const dataFile = path.join(dataDirectory, "expense-data.json");
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ items: [], budgets: defaultBudgets }, null, 2));
  }

  function readState() {
    const state = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (!Array.isArray(state.items) || !state.budgets || typeof state.budgets !== "object") {
      throw new Error("Stored expense data has an invalid format.");
    }
    return state;
  }

  function writeState(state) {
    const temporaryFile = `${dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(state, null, 2));
    fs.renameSync(temporaryFile, dataFile);
  }

  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.get("/api/state", (req, res) => res.json(readState()));

  app.post("/api/transactions", (req, res) => {
    const { type, desc, amount, cat, date } = req.body || {};
    if (type !== "income" && type !== "expense") {
      return res.status(400).json({ error: "Transaction type must be income or expense." });
    }
    if (typeof desc !== "string" || !desc.trim() || desc.trim().length > 60) {
      return res.status(400).json({ error: "Description must be between 1 and 60 characters." });
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 1e10) {
      return res.status(400).json({ error: "Amount must be a positive number." });
    }
    if (!categories[type].includes(cat)) {
      return res.status(400).json({ error: "Choose a valid category for this transaction." });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: "Enter a valid transaction date." });
    }

    const state = readState();
    const item = {
      id: crypto.randomUUID(),
      type,
      desc: desc.trim(),
      amount: Math.round(amount * 100) / 100,
      cat,
      date,
    };
    state.items.push(item);
    writeState(state);
    res.status(201).json(item);
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const state = readState();
    const updatedItems = state.items.filter((item) => item.id !== req.params.id);
    if (updatedItems.length === state.items.length) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    state.items = updatedItems;
    writeState(state);
    res.json({ success: true });
  });

  app.put("/api/budgets", (req, res) => {
    const { category, amount } = req.body || {};
    if (!defaultBudgets.hasOwnProperty(category)) {
      return res.status(400).json({ error: "Choose a valid expense category." });
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1e10) {
      return res.status(400).json({ error: "Budget must be a number greater than or equal to zero." });
    }

    const state = readState();
    state.budgets[category] = Math.round(amount * 100) / 100;
    writeState(state);
    res.json({ budgets: state.budgets });
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status === 413 ? 413 : err instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 400 ? "Invalid JSON request body." : err.message });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  createApp().listen(port, host, () => {
    console.log(`Expense Tracker available at http://${host}:${port}`);
  });
}

module.exports = { createApp };
