import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageReadEditDeleteCommands(
  message: Command,
  helpers: MessageCliHelpers,
) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(message.command("read").description(t("msgCli.readDesc"))),
    )
    .option("--limit <n>", t("msgCli.readLimitOpt"))
    .option("--before <id>", t("msgCli.readBeforeOpt"))
    .option("--after <id>", t("msgCli.readAfterOpt"))
    .option("--around <id>", t("msgCli.readAroundOpt"))
    .option("--include-thread", t("msgCli.readIncludeThreadOpt"), false)
    .action(async (opts) => {
      await helpers.runMessageAction("read", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message
          .command("edit")
          .description(t("msgCli.editDesc"))
          .requiredOption("--message-id <id>", t("msgCli.editMessageIdOpt"))
          .requiredOption("-m, --message <text>", t("msgCli.editMessageOpt")),
      ),
    )
    .option("--thread-id <id>", t("msgCli.editThreadIdOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("edit", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message
          .command("delete")
          .description(t("msgCli.deleteDesc"))
          .requiredOption("--message-id <id>", t("msgCli.deleteMessageIdOpt")),
      ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("delete", opts);
    });
}
