import fs from "node:fs";
import path from "node:path";
import { t } from "../i18n/index.js";
import { note } from "../terminal/note.js";

export function noteSourceInstallIssues(root: string | null) {
  if (!root) {
    return;
  }

  const workspaceMarker = path.join(root, "pnpm-workspace.yaml");
  if (!fs.existsSync(workspaceMarker)) {
    return;
  }

  const warnings: string[] = [];
  const nodeModules = path.join(root, "node_modules");
  const pnpmStore = path.join(nodeModules, ".pnpm");
  const tsxBin = path.join(nodeModules, ".bin", "tsx");
  const srcEntry = path.join(root, "src", "entry.ts");

  if (fs.existsSync(nodeModules) && !fs.existsSync(pnpmStore)) {
    warnings.push(
      t("commands.doctorInstall.notPnpm"),
    );
  }

  if (fs.existsSync(path.join(root, "package-lock.json"))) {
    warnings.push(
      t("commands.doctorInstall.packageLockPresent"),
    );
  }

  if (fs.existsSync(srcEntry) && !fs.existsSync(tsxBin)) {
    warnings.push(t("commands.doctorInstall.tsxMissing"));
  }

  if (warnings.length > 0) {
    note(warnings.join("\n"), t("commands.doctorInstall.title"));
  }
}
