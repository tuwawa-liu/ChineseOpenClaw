import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageThreadCommands(message: Command, helpers: MessageCliHelpers) {
  const thread = message.command("thread").description(t("msgCli.threadDesc"));

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        thread
          .command("create")
          .description(t("msgCli.threadCreateDesc"))
          .requiredOption("--thread-name <name>", t("msgCli.threadNameOpt")),
      ),
    )
    .option("--message-id <id>", t("msgCli.threadMessageIdOpt"))
    .option("-m, --message <text>", t("msgCli.threadMessageOpt"))
    .option("--auto-archive-min <n>", t("msgCli.threadAutoArchiveOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("thread-create", opts);
    });

  helpers
    .withMessageBase(
      thread
        .command("list")
        .description(t("msgCli.threadListDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt")),
    )
    .option("--channel-id <id>", t("msgCli.threadChannelIdOpt"))
    .option("--include-archived", t("msgCli.threadIncludeArchivedOpt"), false)
    .option("--before <id>", t("msgCli.threadBeforeOpt"))
    .option("--limit <n>", t("msgCli.threadLimitOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("thread-list", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        thread
          .command("reply")
          .description(t("msgCli.threadReplyDesc"))
          .requiredOption("-m, --message <text>", t("msgCli.threadReplyMessageOpt")),
      ),
    )
    .option("--media <path-or-url>", t("msgCli.threadReplyMediaOpt"))
    .option("--reply-to <id>", t("msgCli.threadReplyToOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("thread-reply", opts);
    });
}
