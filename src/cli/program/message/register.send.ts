import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageSendCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers
        .withRequiredMessageTarget(
          message
            .command("send")
            .description(t("msgCli.sendDesc"))
            .option("-m, --message <text>", t("msgCli.sendMessageOpt")),
        )
        .option("--media <path-or-url>", t("msgCli.sendMediaOpt"))
        .option("--buttons <json>", t("msgCli.sendButtonsOpt"))
        .option("--components <json>", t("msgCli.sendComponentsOpt"))
        .option("--card <json>", t("msgCli.sendCardOpt"))
        .option("--reply-to <id>", t("msgCli.sendReplyToOpt"))
        .option("--thread-id <id>", t("msgCli.sendThreadIdOpt"))
        .option("--gif-playback", t("msgCli.sendGifPlaybackOpt"), false)
        .option("--silent", t("msgCli.sendSilentOpt"), false),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("send", opts);
    });
}
