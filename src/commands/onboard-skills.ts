import { installSkill } from "../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { OpenClawConfig } from "../config/config.js";
import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import { normalizeSecretInput } from "../utils/normalize-secret-input.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { detectBinary, resolveNodeManagerOptions } from "./onboard-helpers.js";

function summarizeInstallFailure(message: string): string | undefined {
  const cleaned = message.replace(/^Install failed(?:\s*\([^)]*\))?\s*:?\s*/i, "").trim();
  if (!cleaned) {
    return undefined;
  }
  const maxLen = 140;
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function formatSkillHint(skill: {
  description?: string;
  install: Array<{ label: string }>;
}): string {
  const desc = skill.description?.trim();
  const installLabel = skill.install[0]?.label?.trim();
  const combined = desc && installLabel ? `${desc} — ${installLabel}` : desc || installLabel;
  if (!combined) {
    return "install";
  }
  const maxLen = 90;
  return combined.length > maxLen ? `${combined.slice(0, maxLen - 1)}…` : combined;
}

function upsertSkillEntry(
  cfg: OpenClawConfig,
  skillKey: string,
  patch: { apiKey?: string },
): OpenClawConfig {
  const entries = { ...cfg.skills?.entries };
  const existing = (entries[skillKey] as { apiKey?: string } | undefined) ?? {};
  entries[skillKey] = { ...existing, ...patch };
  return {
    ...cfg,
    skills: {
      ...cfg.skills,
      entries,
    },
  };
}

export async function setupSkills(
  cfg: OpenClawConfig,
  workspaceDir: string,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  const report = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
  const eligible = report.skills.filter((s) => s.eligible);
  const unsupportedOs = report.skills.filter(
    (s) => !s.disabled && !s.blockedByAllowlist && s.missing.os.length > 0,
  );
  const missing = report.skills.filter(
    (s) => !s.eligible && !s.disabled && !s.blockedByAllowlist && s.missing.os.length === 0,
  );
  const blocked = report.skills.filter((s) => s.blockedByAllowlist);

  await prompter.note(
    [
      t("commands.onboardSkills.eligible", { count: String(eligible.length) }),
      t("commands.onboardSkills.missingRequirements", { count: String(missing.length) }),
      t("commands.onboardSkills.unsupportedOs", { count: String(unsupportedOs.length) }),
      t("commands.onboardSkills.blockedByAllowlist", { count: String(blocked.length) }),
    ].join("\n"),
    t("commands.onboardSkills.skillsStatus"),
  );

  const shouldConfigure = await prompter.confirm({
    message: t("commands.onboardSkills.configureSkills"),
    initialValue: true,
  });
  if (!shouldConfigure) {
    return cfg;
  }

  const installable = missing.filter(
    (skill) => skill.install.length > 0 && skill.missing.bins.length > 0,
  );
  let next: OpenClawConfig = cfg;
  if (installable.length > 0) {
    const toInstall = await prompter.multiselect({
      message: t("commands.onboardSkills.installMissing"),
      options: [
        {
          value: "__skip__",
          label: t("commands.onboardSkills.skipForNow"),
          hint: t("commands.onboardSkills.skipHint"),
        },
        ...installable.map((skill) => ({
          value: skill.name,
          label: `${skill.emoji ?? "🧩"} ${skill.name}`,
          hint: formatSkillHint(skill),
        })),
      ],
    });

    const selected = toInstall.filter((name) => name !== "__skip__");

    const selectedSkills = selected
      .map((name) => installable.find((s) => s.name === name))
      .filter((item): item is (typeof installable)[number] => Boolean(item));

    const needsBrewPrompt =
      process.platform !== "win32" &&
      selectedSkills.some((skill) => skill.install.some((option) => option.kind === "brew")) &&
      !(await detectBinary("brew"));

    if (needsBrewPrompt) {
      await prompter.note(
        [
          t("commands.onboardSkills.brewNote"),
        ].join("\n"),
        t("commands.onboardSkills.brewRecommended"),
      );
      const showBrewInstall = await prompter.confirm({
        message: t("commands.onboardSkills.showBrewInstall"),
        initialValue: true,
      });
      if (showBrewInstall) {
        await prompter.note(
          [
            "运行：",
            '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          ].join("\n"),
          t("commands.onboardSkills.brewInstallTitle"),
        );
      }
    }

    const needsNodeManagerPrompt = selectedSkills.some((skill) =>
      skill.install.some((option) => option.kind === "node"),
    );
    if (needsNodeManagerPrompt) {
      const nodeManager = (await prompter.select({
        message: t("commands.onboardSkills.nodeManagerPrompt"),
        options: resolveNodeManagerOptions(),
      })) as "npm" | "pnpm" | "bun";
      next = {
        ...next,
        skills: {
          ...next.skills,
          install: {
            ...next.skills?.install,
            nodeManager,
          },
        },
      };
    }

    for (const name of selected) {
      const target = installable.find((s) => s.name === name);
      if (!target || target.install.length === 0) {
        continue;
      }
      const installId = target.install[0]?.id;
      if (!installId) {
        continue;
      }
      const spin = prompter.progress(t("commands.onboardSkills.installing", { name }));
      const result = await installSkill({
        workspaceDir,
        skillName: target.name,
        installId,
        config: next,
      });
      const warnings = result.warnings ?? [];
      if (result.ok) {
        spin.stop(warnings.length > 0 ? t("commands.onboardSkills.installedWithWarnings", { name }) : t("commands.onboardSkills.installed", { name }));
        for (const warning of warnings) {
          runtime.log(warning);
        }
        continue;
      }
      const code = result.code == null ? "" : ` (exit ${result.code})`;
      const detail = summarizeInstallFailure(result.message);
      spin.stop(t("commands.onboardSkills.installFailed", { name, code, detail: detail ? ` — ${detail}` : "" }));
      for (const warning of warnings) {
        runtime.log(warning);
      }
      if (result.stderr) {
        runtime.log(result.stderr.trim());
      } else if (result.stdout) {
        runtime.log(result.stdout.trim());
      }
      runtime.log(
        t("commands.onboardSkills.doctorTip", { command: formatCliCommand("openclaw doctor") }),
      );
      runtime.log(t("commands.onboardSkills.docsLink"));
    }
  }

  for (const skill of missing) {
    if (!skill.primaryEnv || skill.missing.env.length === 0) {
      continue;
    }
    const wantsKey = await prompter.confirm({
      message: t("commands.onboardSkills.setEnvConfirm", { env: skill.primaryEnv, name: skill.name }),
      initialValue: false,
    });
    if (!wantsKey) {
      continue;
    }
    const apiKey = String(
      await prompter.text({
        message: t("commands.onboardSkills.enterEnv", { env: skill.primaryEnv }),
        validate: (value) => (value?.trim() ? undefined : t("commands.onboardSkills.required")),
      }),
    );
    next = upsertSkillEntry(next, skill.skillKey, { apiKey: normalizeSecretInput(apiKey) });
  }

  return next;
}
