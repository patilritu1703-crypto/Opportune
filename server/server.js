import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAll, addSkillGapRecommendations } from "./matching.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_FILE = path.join(__dirname, "data", "opportunities.json");

function loadOpportunities() {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

// Cache in memory; the dataset is static seed data for the demo.
let OPPORTUNITIES = loadOpportunities();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function validateProfile(body) {
  const errors = [];
  const profile = {
    name: typeof body.name === "string" ? body.name.trim().slice(0, 80) : "",
    education: typeof body.education === "string" ? body.education.trim().slice(0, 120) : "",
    college: typeof body.college === "string" ? body.college.trim().slice(0, 120) : "",
    year: typeof body.year === "string" ? body.year.trim().slice(0, 40) : "",
    skills: Array.isArray(body.skills) ? body.skills.filter((s) => typeof s === "string").slice(0, 30) : [],
    interests: Array.isArray(body.interests) ? body.interests.filter((s) => typeof s === "string").slice(0, 20) : [],
    categories: Array.isArray(body.categories) ? body.categories.filter((s) => typeof s === "string").slice(0, 10) : [],
  };
  if (!profile.name) errors.push("Name is required.");
  if (!profile.education) errors.push("Education is required.");
  if (profile.skills.length === 0 && profile.interests.length === 0) {
    errors.push("Select at least one skill or interest.");
  }
  return { profile, errors };
}

async function handleApi(req, res, url) {
  // Health check
  if (url.pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok", opportunities: OPPORTUNITIES.length });
  }

  // Raw catalog (no scoring) — used for Explore page filter options etc.
  if (url.pathname === "/api/opportunities" && req.method === "GET") {
    return sendJson(res, 200, { opportunities: OPPORTUNITIES });
  }

  // Score opportunities against a submitted profile.
  if (url.pathname === "/api/match" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const { profile, errors } = validateProfile(body);
      if (errors.length) {
        return sendJson(res, 400, { error: "Invalid profile", details: errors });
      }
      const scored = addSkillGapRecommendations(profile, scoreAll(profile, OPPORTUNITIES), OPPORTUNITIES);
      return sendJson(res, 200, { profile, results: scored });
    } catch (err) {
      return sendJson(res, 400, { error: "Malformed request body." });
    }
  }

  // Distinct filter values, computed from the dataset (categories, skills, locations)
  if (url.pathname === "/api/meta" && req.method === "GET") {
    const categories = [...new Set(OPPORTUNITIES.map((o) => o.category))].sort();
    const skills = [...new Set(OPPORTUNITIES.flatMap((o) => o.skills))].sort();
    const interests = [...new Set(OPPORTUNITIES.flatMap((o) => o.interests))].sort();
    const locations = [...new Set(OPPORTUNITIES.map((o) => o.location))].sort();
    return sendJson(res, 200, { categories, skills, interests, locations });
  }

  return sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  let reqPath = decodeURIComponent(url.pathname);
  if (reqPath === "/") reqPath = "/index.html";
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath);

  // SPA fallback: unknown non-file routes go to index.html
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      filePath = path.join(PUBLIC_DIR, "index.html");
    }
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err2, content) => {
      if (err2) {
        res.writeHead(500);
        return res.end("Server error");
      }
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(content);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`OpporTune server running on http://localhost:${PORT}`);
});
