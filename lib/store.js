import fs from "fs/promises";
import path from "path";
import { MongoClient } from "mongodb";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matches(item, query) {
  if (query.department && item.department !== query.department) return false;
  if (query.minRating && item.average < query.minRating) return false;
  if (query.q) {
    const haystack = [item.course, item.faculty, item.comments, item.suggestions, item.name, item.roll]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query.q.toLowerCase())) return false;
  }
  return true;
}

function sortNewest(items) {
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function clean(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function openStore({ dataFile }) {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) return openMongo(uri);
  return openFile(dataFile);
}

async function openFile(dataFile) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  let records = [];
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed.feedback) ? parsed.feedback : [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  let chain = Promise.resolve();
  const persist = () => {
    chain = chain.then(() =>
      fs.writeFile(dataFile, JSON.stringify({ feedback: records }, null, 2))
    );
    return chain;
  };

  return {
    mode: "file",
    label: "Local file store",
    async list(query = {}) {
      return sortNewest(records.filter((item) => matches(item, query)));
    },
    async get(id) {
      return records.find((item) => item.id === id) || null;
    },
    async insert(doc) {
      records.push(doc);
      await persist();
      return doc;
    },
    async remove(id) {
      const before = records.length;
      records = records.filter((item) => item.id !== id);
      if (records.length === before) return false;
      await persist();
      return true;
    }
  };
}

async function openMongo(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  const databaseName = process.env.MONGODB_DB?.trim() || "student_feedback";
  const collection = client.db(databaseName).collection("feedback");
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ createdAt: -1 });

  const filterFor = (query) => {
    const filter = {};
    if (query.department) filter.department = query.department;
    if (query.minRating) filter.average = { $gte: query.minRating };
    if (query.q) {
      const pattern = escapeRegex(query.q);
      filter.$or = ["course", "faculty", "comments", "suggestions", "name", "roll"].map((field) => ({
        [field]: { $regex: pattern, $options: "i" }
      }));
    }
    return filter;
  };

  const host = (() => {
    try {
      return new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).host;
    } catch {
      return "mongodb";
    }
  })();

  return {
    mode: "mongodb",
    label: host.includes("mongodb.net") ? "MongoDB Atlas" : "MongoDB",
    client,
    async list(query = {}) {
      const docs = await collection.find(filterFor(query)).sort({ createdAt: -1 }).limit(500).toArray();
      return docs.map(clean);
    },
    async get(id) {
      return clean(await collection.findOne({ id }));
    },
    async insert(doc) {
      await collection.insertOne({ ...doc });
      return doc;
    },
    async remove(id) {
      const result = await collection.deleteOne({ id });
      return result.deletedCount > 0;
    }
  };
}
