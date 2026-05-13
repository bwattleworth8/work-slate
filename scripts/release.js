const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");

loadEnvFile(path.join(ROOT_DIR, ".env"));

if (!process.env.GH_TOKEN) {
  console.error("GH_TOKEN is not set. Add it to .env before running npm run release.");
  process.exit(1);
}

run(process.execPath, [path.join(ROOT_DIR, "scripts", "generate-icons.js")]);
run(getLocalBin("electron-builder"), ["--win", "nsis", "--publish", "always"]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = normalizeEnvValue(trimmed.slice(separatorIndex + 1).trim());
  }
}

function normalizeEnvValue(value) {
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
}

function getLocalBin(name) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  return path.join(ROOT_DIR, "node_modules", ".bin", `${name}${extension}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
