import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import { CHANNEL_TARGETS_DESCRIPTION } from "../../../infra/outbound/channel-target.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageBroadcastCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(message.command("broadcast").description(t("msgCli.broadcastDesc")))
    .requiredOption("--targets <target...>", CHANNEL_TARGETS_DESCRIPTION)
    .option("--message <text>", t("msgCli.broadcastMessageOpt"))
    .option("--media <url>", t("msgCli.broadcastMediaOpt"))
    .action(async (options: Record<string, unknown>) => {
      await helpers.runMessageAction("broadcast", options);
    });
}
