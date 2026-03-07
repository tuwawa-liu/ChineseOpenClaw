import { getChannelPlugin, listChannelPlugins } from "../channels/plugins/index.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { OpenClawConfig } from "../config/config.js";
import { CONFIG_PATH } from "../config/config.js";
import { t } from "../i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import { note } from "../terminal/note.js";
import { shortenHomePath } from "../utils.js";
import { confirm, select } from "./configure.shared.js";
import { guardCancel } from "./onboard-helpers.js";

export async function removeChannelConfigWizard(
  cfg: OpenClawConfig,
  runtime: RuntimeEnv,
): Promise<OpenClawConfig> {
  let next = { ...cfg };

  const listConfiguredChannels = () =>
    listChannelPlugins()
      .map((plugin) => plugin.meta)
      .filter((meta) => next.channels?.[meta.id] !== undefined);

  while (true) {
    const configured = listConfiguredChannels();
    if (configured.length === 0) {
      note(
        [
          t("commands.configureChannels.noChannelConfig"),
          t("commands.configureChannels.tipChannelStatus"),
        ].join("\n"),
        t("commands.configureChannels.removeChannel"),
      );
      return next;
    }

    const channel = guardCancel(
      await select({
        message: t("commands.configureChannels.removeWhich"),
        options: [
          ...configured.map((meta) => ({
            value: meta.id,
            label: meta.label,
            hint: t("commands.configureChannels.warningDelete"),
          })),
          { value: "done", label: t("commands.configureChannels.done") },
        ],
      }),
      runtime,
    );

    if (channel === "done") {
      return next;
    }

    const label = getChannelPlugin(channel)?.meta.label ?? channel;
    const confirmed = guardCancel(
      await confirm({
        message: t("commands.configureChannels.deleteConfirm", { label, path: shortenHomePath(CONFIG_PATH) }),
        initialValue: false,
      }),
      runtime,
    );
    if (!confirmed) {
      continue;
    }

    const nextChannels: Record<string, unknown> = { ...next.channels };
    delete nextChannels[channel];
    next = {
      ...next,
      channels: Object.keys(nextChannels).length
        ? (nextChannels as OpenClawConfig["channels"])
        : undefined,
    };

    note(
      [t("commands.configureChannels.removed", { label }), t("commands.configureChannels.noteCredentials")].join(
        "\n",
      ),
      t("commands.configureChannels.channelRemoved"),
    );
  }
}
