import fs from "node:fs/promises";
import path from "node:path";
import {
  resolveControlUiDistIndexHealth,
  resolveControlUiDistIndexPathForRoot,
} from "../infra/control-ui-assets.js";
import { resolveOpenClawPackageRoot } from "../infra/openclaw-root.js";
import { runCommandWithTimeout } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { note } from "../terminal/note.js";
import type { DoctorPrompter } from "./doctor-prompter.js";

export async function maybeRepairUiProtocolFreshness(
  _runtime: RuntimeEnv,
  prompter: DoctorPrompter,
) {
  const root = await resolveOpenClawPackageRoot({
    moduleUrl: import.meta.url,
    argv1: process.argv[1],
    cwd: process.cwd(),
  });

  if (!root) {
    return;
  }

  const schemaPath = path.join(root, "src/gateway/protocol/schema.ts");
  const uiHealth = await resolveControlUiDistIndexHealth({
    root,
    argv1: process.argv[1],
  });
  const uiIndexPath = uiHealth.indexPath ?? resolveControlUiDistIndexPathForRoot(root);

  try {
    const [schemaStats, uiStats] = await Promise.all([
      fs.stat(schemaPath).catch(() => null),
      fs.stat(uiIndexPath).catch(() => null),
    ]);

    if (schemaStats && !uiStats) {
      note(["- 控制面板 UI 资源缺失。", "- 运行：pnpm ui:build"].join("\n"), "UI");

      // In slim/docker environments we may not have the UI source tree. Trying
      // to build would fail (and spam logs), so skip the interactive repair.
      const uiSourcesPath = path.join(root, "ui/package.json");
      const uiSourcesExist = await fs.stat(uiSourcesPath).catch(() => null);
      if (!uiSourcesExist) {
        note("跳过 UI 构建：ui/ 源文件不存在。", "UI");
        return;
      }

      const shouldRepair = await prompter.confirmRepair({
        message: "立即构建控制面板 UI 资源？",
        initialValue: true,
      });

      if (shouldRepair) {
        note("正在构建控制面板 UI 资源...（可能需要一些时间）", "UI");
        const uiScriptPath = path.join(root, "scripts/ui.js");
        const buildResult = await runCommandWithTimeout([process.execPath, uiScriptPath, "build"], {
          cwd: root,
          timeoutMs: 120_000,
          env: { ...process.env, FORCE_COLOR: "1" },
        });
        if (buildResult.code === 0) {
          note("UI 构建完成。", "UI");
        } else {
          const details = [
            `UI build failed (exit ${buildResult.code ?? "unknown"}).`,
            buildResult.stderr.trim() ? buildResult.stderr.trim() : null,
          ]
            .filter(Boolean)
            .join("\n");
          note(details, "UI");
        }
      }
      return;
    }

    if (!schemaStats || !uiStats) {
      return;
    }

    if (schemaStats.mtime > uiStats.mtime) {
      const uiMtimeIso = uiStats.mtime.toISOString();
      // Find changes since the UI build
      const gitLog = await runCommandWithTimeout(
        [
          "git",
          "-C",
          root,
          "log",
          `--since=${uiMtimeIso}`,
          "--format=%h %s",
          "src/gateway/protocol/schema.ts",
        ],
        { timeoutMs: 5000 },
      ).catch(() => null);

      if (gitLog && gitLog.code === 0 && gitLog.stdout.trim()) {
        note(
          `UI assets are older than the protocol schema.\nFunctional changes since last build:\n${gitLog.stdout
            .trim()
            .split("\n")
            .map((l) => `- ${l}`)
            .join("\n")}`,
          "UI Freshness",
        );

        const shouldRepair = await prompter.confirmAggressive({
          message: "立即重建 UI？（检测到协议不匹配需要更新）",
          initialValue: true,
        });

        if (shouldRepair) {
          const uiSourcesPath = path.join(root, "ui/package.json");
          const uiSourcesExist = await fs.stat(uiSourcesPath).catch(() => null);
          if (!uiSourcesExist) {
            note("跳过 UI 重建：ui/ 源文件不存在。", "UI");
            return;
          }

          note("正在重建过期 UI 资源...（可能需要一些时间）", "UI");
          // Use scripts/ui.js to build, assuming node is available as we are running in it.
          // We use the same node executable to run the script.
          const uiScriptPath = path.join(root, "scripts/ui.js");
          const buildResult = await runCommandWithTimeout(
            [process.execPath, uiScriptPath, "build"],
            {
              cwd: root,
              timeoutMs: 120_000,
              env: { ...process.env, FORCE_COLOR: "1" },
            },
          );
          if (buildResult.code === 0) {
            note("UI 重建完成。", "UI");
          } else {
            const details = [
              `UI rebuild failed (exit ${buildResult.code ?? "unknown"}).`,
              buildResult.stderr.trim() ? buildResult.stderr.trim() : null,
            ]
              .filter(Boolean)
              .join("\n");
            note(details, "UI");
          }
        }
      }
    }
  } catch {
    // If files don't exist, we can't check.
    // If git fails, we silently skip.
    // runtime.debug(`UI freshness check failed: ${String(err)}`);
  }
}
