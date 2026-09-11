#!/usr/bin/env node
// Builds a portable release folder: `npm run build`, pkg the CommonJS bundle
// into a single exe, then copy static/ and the Prisma query engine into a
// system/ folder next to it as plain files (not embedded in pkg's snapshot —
// see src/paths.ts:getPackagedPrismaEngineLibraryPath for why). `bin/` is
// deliberately NOT created here; the app creates it next to the exe on first
// run (src/paths.ts:getBinDir).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// On Windows, npm/npx are .cmd shims — execFileSync needs the explicit
// extension (or shell:true) to find them via PATH.
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

function getGitVersion(cwd) {
  const tryRun = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };

  // 1. Tag pointing directly at HEAD
  let tag = tryRun("git", ["tag", "--points-at", "HEAD"]).split("\n")[0].trim();
  if (tag) {
    const match = tag.match(/[a-zA-Z0-9._-]+/);
    if (match) return match[0];
  }

  // 2. Latest commit message leading version (e.g. "V2.6.1.1", "V2.6 增加檔案上傳與管理模組")
  const msg = tryRun("git", ["log", "-1", "--pretty=%B"]);
  if (msg) {
    const norm = msg.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
    const match = norm.match(/^([a-zA-Z0-9._-]+)/);
    if (match) {
      const ver = match[1];
      // Automatically register the tag on HEAD if not already tagged
      tryRun("git", ["tag", ver]);
      return ver;
    }
  }

  // 3. Fallback to latest tag in repository
  tag = tryRun("git", ["describe", "--tags", "--abbrev=0"]).split("\n")[0].trim();
  if (!tag) tag = tryRun("git", ["tag", "--sort=-creatordate"]).split("\n")[0].trim();
  if (tag) {
    const match = tag.match(/[a-zA-Z0-9._-]+/);
    if (match) return match[0];
  }

  return "";
}

const gitVersion = getGitVersion(rootDir);
console.log(`[build-exe] Detected version tag: ${gitVersion || "none"}`);

const TARGETS = {
  win: {
    pkgTarget: "node22-win-x64",
    engineGlob: "query_engine-windows.dll.node",
    baseName: "TeachSYS",
    ext: ".exe",
  },
  "mac-smoketest": {
    pkgTarget: `node22-macos-${process.arch}`,
    engineGlob: "libquery_engine-darwin-*.node",
    baseName: "TeachSYS",
    ext: "",
  },
};

const which = process.argv[2];
if (!which || !TARGETS[which]) {
  console.error(`Usage: node scripts/build-exe.mjs <${Object.keys(TARGETS).join("|")}>`);
  process.exit(1);
}
const target = TARGETS[which];
const exeName = gitVersion ? `${target.baseName}_${gitVersion}${target.ext}` : `${target.baseName}${target.ext}`;
const defaultExeName = `${target.baseName}${target.ext}`;
const outDir = path.join(rootDir, "release", which);

console.log("[1/4] building project (npm run build)");
try {
  execFileSync(npmCmd, ["run", "build"], { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
} catch (buildErr) {
  const testEngineDir = path.join(rootDir, "node_modules", ".prisma", "client");
  const existingEngine = fs.globSync(target.engineGlob, { cwd: testEngineDir })[0];
  if (existingEngine) {
    console.warn("\n[build-exe] 注意：prisma generate 因本機正運行 dev server 鎖定 DLL 而跳過，正在以現有 Prisma Client 進行 TypeScript 編譯...");
    execFileSync(npxCmd, ["tsc", "-p", "tsconfig.json"], { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
  } else {
    throw buildErr;
  }
}

console.log(`[2/4] locating Prisma engine (${target.engineGlob})`);
const engineDir = path.join(rootDir, "node_modules", ".prisma", "client");
const engineFile = fs.globSync(target.engineGlob, { cwd: engineDir })[0];
if (!engineFile) {
  throw new Error(
    `No Prisma engine matching "${target.engineGlob}" found in ${engineDir}. ` +
      `Check the generator's "binaryTargets" in prisma/schema.prisma and re-run "npx prisma generate".`
  );
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

console.log(`[3/4] pkg dist/index.js --targets ${target.pkgTarget} -> ${exeName}`);
execFileSync(
  npxCmd,
  ["@yao-pkg/pkg", "dist/index.js", "--targets", target.pkgTarget, "--output", path.join(outDir, exeName)],
  { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" }
);

if (exeName !== defaultExeName) {
  fs.copyFileSync(path.join(outDir, exeName), path.join(outDir, defaultExeName));
}

console.log("[4/4] copying static/ and engine/ into system/ next to the exe");
const systemDir = path.join(outDir, "system");
fs.cpSync(path.join(rootDir, "static"), path.join(systemDir, "static"), { recursive: true });
fs.mkdirSync(path.join(systemDir, "engine"), { recursive: true });
fs.copyFileSync(path.join(engineDir, engineFile), path.join(systemDir, "engine", engineFile));

if (gitVersion) {
  const versionedDir = path.join(rootDir, "release", `${target.baseName}_${gitVersion}_${which}`);
  fs.rmSync(versionedDir, { recursive: true, force: true });
  fs.cpSync(outDir, versionedDir, { recursive: true });
  console.log(`Versioned folder created: ${versionedDir}`);

  const cmDir = path.join(rootDir, "release", `ClassroomManager_${gitVersion}_${which}`);
  fs.rmSync(cmDir, { recursive: true, force: true });
  fs.cpSync(outDir, cmDir, { recursive: true });
  console.log(`ClassroomManager folder created: ${cmDir}`);
}

console.log(`Done: ${outDir} (${exeName})`);
