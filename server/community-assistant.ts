import express from "express";
import fs from "fs";
import path from "path";

interface Capability {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags?: string[];
}

const communityRouter = express.Router();

const loadCapabilities = () => {
  const manifestPath = path.join(process.cwd(), "client", "capabilities", "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  return manifest.capabilities || [];
};

const buildResponse = (query: string) => {
  const capabilities = loadCapabilities();
  const normalized = query.toLowerCase();
  const matches = capabilities.filter((cap: Capability) => {
    const haystack = [cap.title, cap.summary, cap.category, ...(cap.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });

  const suggestions = [
    "Try searching by category such as finance, code, medical, or creative.",
    "Use tags like 'forecast', 'typescript', or 'diagnosis' to narrow results.",
    "Check the leaderboard for top‑scoring capabilities.",
  ];

  return {
    query,
    suggestions,
    capabilities: matches.slice(0, 5).map((cap: Capability) => ({
      id: cap.id,
      title: cap.title,
      summary: cap.summary,
      category: cap.category,
      tags: cap.tags,
    })),
    message: matches.length
      ? "Here are capabilities related to your query."
      : "No direct match found. Try broader terms or check the leaderboard.",
  };
};

communityRouter.get("/assistant", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  res.json(buildResponse(query));
});

communityRouter.post("/assistant", (req, res) => {
  const query = typeof req.body?.question === "string" ? req.body.question : "";
  res.json(buildResponse(query));
});

export default communityRouter;
