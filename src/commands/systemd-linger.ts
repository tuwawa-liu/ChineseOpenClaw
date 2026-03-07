import {
  enableSystemdUserLinger,
  isSystemdUserServiceAvailable,
  readSystemdUserLingerStatus,
} from "../daemon/systemd.js";
import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import { note } from "../terminal/note.js";

export type LingerPrompter = {
  confirm?: (params: { message: string; initialValue?: boolean }) => Promise<boolean>;
  note: (message: string, title?: string) => Promise<void> | void;
};

export async function ensureSystemdUserLingerInteractive(params: {
  runtime: RuntimeEnv;
  prompter?: LingerPrompter;
  env?: NodeJS.ProcessEnv;
  title?: string;
  reason?: string;
  prompt?: boolean;
  requireConfirm?: boolean;
}): Promise<void> {
  if (process.platform !== "linux") {
    return;
  }
  if (params.prompt === false) {
    return;
  }
  const env = params.env ?? process.env;
  const prompter = params.prompter ?? { note };
  const title = params.title ?? "Systemd";
  if (!(await isSystemdUserServiceAvailable())) {
    await prompter.note(t("commands.systemdLinger.unavailable"), title);
    return;
  }
  const status = await readSystemdUserLingerStatus(env);
  if (!status) {
    await prompter.note(
      t("commands.systemdLinger.unableToRead"),
      title,
    );
    return;
  }
  if (status.linger === "yes") {
    return;
  }

  const reason =
    params.reason ??
    t("commands.systemdLinger.reason");
  const actionNote = params.requireConfirm
    ? t("commands.systemdLinger.actionConfirm")
    : t("commands.systemdLinger.actionAuto");
  await prompter.note(`${reason}\n${actionNote}`, title);

  if (params.requireConfirm && prompter.confirm) {
    const ok = await prompter.confirm({
      message: t("commands.systemdLinger.enableConfirm", { user: status.user }),
      initialValue: true,
    });
    if (!ok) {
      await prompter.note(t("commands.systemdLinger.withoutLinger"), title);
      return;
    }
  }

  const resultNoSudo = await enableSystemdUserLinger({
    env,
    user: status.user,
  });
  if (resultNoSudo.ok) {
    await prompter.note(t("commands.systemdLinger.enabled", { user: status.user }), title);
    return;
  }

  const result = await enableSystemdUserLinger({
    env,
    user: status.user,
    sudoMode: "prompt",
  });
  if (result.ok) {
    await prompter.note(t("commands.systemdLinger.enabled", { user: status.user }), title);
    return;
  }

  params.runtime.error(
    t("commands.systemdLinger.enableFailed", { error: result.stderr || result.stdout || "unknown error" }),
  );
  await prompter.note(t("commands.systemdLinger.runManually", { user: status.user }), title);
}

export async function ensureSystemdUserLingerNonInteractive(params: {
  runtime: RuntimeEnv;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  if (process.platform !== "linux") {
    return;
  }
  const env = params.env ?? process.env;
  if (!(await isSystemdUserServiceAvailable())) {
    return;
  }
  const status = await readSystemdUserLingerStatus(env);
  if (!status || status.linger === "yes") {
    return;
  }

  const result = await enableSystemdUserLinger({
    env,
    user: status.user,
    sudoMode: "non-interactive",
  });
  if (result.ok) {
    params.runtime.log(t("commands.systemdLinger.enabled", { user: status.user }));
    return;
  }

  params.runtime.log(
    t("commands.systemdLinger.lingerDisabled", { user: status.user }),
  );
}
