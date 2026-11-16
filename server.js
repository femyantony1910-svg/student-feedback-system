import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { ACADEMIC_YEARS, DEPARTMENTS, RATING_FIELDS, validateFeedback } from "./lib/schema.js";
import { openStore } from "./lib/store.js";
import { loadEnv } from "./lib/env.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";
const publicDir = path.join(__dirname, "public");

const store = await openStore({
  dataFile: path.join(__dirname, "data", "feedback.json")
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: store.mode,
    label: store.label
  });
});

app.get("/api/meta", (_req, res) => {
  res.json({
    storage: store.mode,
    label: store.label,
    departments: DEPARTMENTS,
    academicYears: ACADEMIC_YEARS,
    ratings: RATING_FIELDS,
    semesters: [1, 2, 3, 4, 5, 6, 7, 8]
  });
});

app.get("/api/feedback", async (req, res, next) => {
  try {
    const query = readQuery(req);
    const responses = await store.list(query);
    res.json({
      storage: store.mode,
      label: store.label,
      count: responses.length,
      responses
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/feedback/:id", async (req, res, next) => {
  try {
    const item = await store.get(req.params.id);
    if (!item) return res.status(404).json({ error: "That response was not found." });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.get("/api/stats", async (_req, res, next) => {
  try {
    const responses = await store.list({});
    const total = responses.length;
    const average = total
      ? Math.round((responses.reduce((sum, item) => sum + item.average, 0) / total) * 10) / 10
      : 0;

    const grouped = new Map();
    for (const item of responses) {
      const current = grouped.get(item.department) || { department: item.department, count: 0, total: 0 };
      current.count += 1;
      current.total += item.average;
      grouped.set(item.department, current);
    }

    const byDepartment = [...grouped.values()]
      .map((row) => ({
        department: row.department,
        count: row.count,
        average: Math.round((row.total / row.count) * 10) / 10
      }))
      .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department));

    res.json({
      storage: store.mode,
      label: store.label,
      total,
      average,
      byDepartment
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/feedback", async (req, res, next) => {
  try {
    const result = validateFeedback(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    const saved = await store.insert({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...result.value
    });
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/feedback/:id", async (req, res, next) => {
  try {
    if (!authorized(req)) {
      return res.status(401).json({ error: "Enter the academic office key to remove a response." });
    }
    const removed = await store.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: "That response was not found." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir));
app.get("/responses", (_req, res) => {
  res.sendFile(path.join(publicDir, "responses.html"));
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be JSON." });
  }
  console.error(error);
  res.status(500).json({ error: "The feedback service could not complete that request." });
});

app.listen(PORT, () => {
  console.log(`Student Feedback listening on http://localhost:${PORT}`);
  console.log(`Storage: ${store.label} (${store.mode})`);
});

function readQuery(req) {
  const department = typeof req.query.department === "string" ? req.query.department.trim() : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const minRating = Number(req.query.minRating);
  return {
    department: DEPARTMENTS.includes(department) ? department : "",
    q,
    minRating: Number.isFinite(minRating) && minRating > 0 ? minRating : 0
  };
}

function authorized(req) {
  const provided = req.get("x-admin-key") || "";
  const left = Buffer.from(provided);
  const right = Buffer.from(ADMIN_KEY);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
