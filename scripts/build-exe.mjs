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
    baseName: "ClassManager",
    ext: ".exe",
  },
  "mac-smoketest": {
    pkgTarget: `node22-macos-${process.arch}`,
    engineGlob: "libquery_engine-darwin-*.node",
    baseName: "ClassManager",
    ext: "",
    isMac: true,
  },
};

const which = process.argv[2];
if (!which || !TARGETS[which]) {
  console.error(`Usage: node scripts/build-exe.mjs <${Object.keys(TARGETS).join("|")}>`);
  process.exit(1);
}
const target = TARGETS[which];
const normVersion = gitVersion
  ? gitVersion.startsWith("V") || gitVersion.startsWith("v")
    ? `V${gitVersion.slice(1)}`
    : `V${gitVersion}`
  : "";
const exeName = normVersion ? `${target.baseName}${normVersion}${target.ext}` : `${target.baseName}${target.ext}`;
const folderName = normVersion ? `${target.baseName}${normVersion}` : target.baseName;
const outDir = path.join(rootDir, "release", folderName);

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
const systemDir = path.join(outDir, "system");
fs.mkdirSync(systemDir, { recursive: true });

// On Windows the exe stays at the top level (outDir) so double-clicking it
// in Explorer just works. On mac the exe is placed *inside* system/ instead,
// so the only thing visible at the top level is the .command launcher below
// — src/paths.ts:getAppRootDir() knows to step up out of a "system" parent
// when locating bin/ and system/ at runtime.
const exeDir = target.isMac ? systemDir : outDir;
const exePath = path.join(exeDir, exeName);

console.log(`[3/4] pkg dist/index.js --targets ${target.pkgTarget} -> ${path.relative(outDir, exePath)}`);
execFileSync(
  npxCmd,
  ["@yao-pkg/pkg", "dist/index.js", "--targets", target.pkgTarget, "--output", exePath],
  { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" }
);

console.log("[4/4] copying static/ and engine/ into system/");
fs.cpSync(path.join(rootDir, "static"), path.join(systemDir, "static"), { recursive: true });
fs.mkdirSync(path.join(systemDir, "engine"), { recursive: true });
fs.copyFileSync(path.join(engineDir, engineFile), path.join(systemDir, "engine", engineFile));

if (target.isMac) {
  // A bare Mach-O binary has no registered LaunchServices handler, so
  // double-clicking it in Finder fails silently ("no application knows how
  // to open this file" — kLSApplicationNotFoundErr). A `.command` file *is*
  // a recognized document type: Finder opens it in Terminal.app and Terminal
  // executes it directly, side-stepping the missing-handler problem. It's
  // the only thing left at the top level — the real binary lives in system/.
  const commandName = `${exeName}.command`;
  const commandPath = path.join(outDir, commandName);
  fs.writeFileSync(
    commandPath,
    `#!/bin/bash\ncd "$(dirname "$0")"\n./system/"${exeName}"\n`,
    { mode: 0o755 }
  );
  fs.chmodSync(commandPath, 0o755);

  // Best-effort ad-hoc codesign so the raw binary at least has a valid local
  // signature. This does NOT satisfy Gatekeeper on another Mac (that needs a
  // paid Developer ID + notarization) — teachers copying this to a different
  // machine will still need to right-click > Open the first time, or run
  // `xattr -d com.apple.quarantine <file>`, to clear the quarantine flag
  // that Finder/AirDrop/Zip attaches on transfer.
  try {
    execFileSync("codesign", ["--force", "--sign", "-", exePath], { stdio: "ignore" });
  } catch {
    /* codesign not available or failed — non-fatal, see note above */
  }

  console.log(`[build-exe] Top level now only has ${commandName} — the exe moved into system/.`);
  console.log(
    "[build-exe] NOTE: this build is unsigned (ad-hoc only). On first launch on any Mac " +
      "(including this one, once the files are zipped/AirDropped/downloaded), Gatekeeper " +
      "may refuse to open it. Right-click the .command file (or the exe) and choose \"Open\" " +
      "once to allow it, or run: xattr -dr com.apple.quarantine \"" + outDir + "\""
  );
}

console.log(`\n[build-exe] Done! Single package created at: ${outDir}`);
console.log(`[build-exe] Executable: ${exeName}`);

