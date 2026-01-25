import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "client", "capabilities", "manifest.json");
const outputDirs = [
  path.join(rootDir, "metrics"),
  path.join(rootDir, "client", "public", "metrics"),
];

const safeNumber = (value, fallback = 0) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return fallback;
};

const normalize = (value, min, max) => {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
};

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const capabilities = manifest.capabilities || [];

const throughputValues = capabilities.map((c) => safeNumber(c.metrics?.throughputQps));
const latencyValues = capabilities.map((c) => safeNumber(c.metrics?.latencyMs));
const minThroughput = Math.min(...throughputValues, 0);
const maxThroughput = Math.max(...throughputValues, 1);
const minLatency = Math.min(...latencyValues, 0);
const maxLatency = Math.max(...latencyValues, 1);

const scored = capabilities.map((capability) => {
  const accuracy = safeNumber(capability.metrics?.accuracy, 0);
  const rating = safeNumber(capability.rating, 0);
  const throughput = safeNumber(capability.metrics?.throughputQps, 0);
  const latency = safeNumber(capability.metrics?.latencyMs, maxLatency);

  const throughputScore = normalize(throughput, minThroughput, maxThroughput);
  const latencyScore = 1 - normalize(latency, minLatency, maxLatency);

  const score =
    accuracy * 0.5 +
    (rating / 5) * 0.3 +
    throughputScore * 0.15 +
    latencyScore * 0.05;

  return {
    id: capability.id,
    title: capability.title,
    category: capability.category,
    score: Number(score.toFixed(4)),
    rating: rating,
    metrics: capability.metrics,
  };
});

const leaderboard = scored
  .sort((a, b) => b.score - a.score)
  .map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

const summary = {
  generatedAt: new Date().toISOString(),
  totalCapabilities: leaderboard.length,
  averageScore: leaderboard.length
    ? Number(
        (
          leaderboard.reduce((sum, entry) => sum + entry.score, 0) /
          leaderboard.length
        ).toFixed(4)
      )
    : 0,
  topCategory: leaderboard[0]?.category || null,
};

for (const dir of outputDirs) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "leaderboard.json"),
    JSON.stringify({ generatedAt: summary.generatedAt, leaderboard }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
}

console.log("Capability evaluation complete.");
