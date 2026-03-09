import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageReactionsCommands(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("react").description(t("msgCli.reactDesc")),
      ),
    )
    .requiredOption("--message-id <id>", t("msgCli.reactMessageIdOpt"))
    .option("--emoji <emoji>", t("msgCli.reactEmojiOpt"))
    .option("--remove", t("msgCli.reactRemoveOpt"), false)
    .option("--participant <id>", t("msgCli.reactParticipantOpt"))
    .option("--from-me", t("msgCli.reactFromMeOpt"), false)
    .option("--target-author <id>", t("msgCli.reactTargetAuthorOpt"))
    .option("--target-author-uuid <uuid>", t("msgCli.reactTargetAuthorUuidOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("react", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("reactions").description(t("msgCli.reactionsDesc")),
      ),
    )
    .requiredOption("--message-id <id>", t("msgCli.reactionsMessageIdOpt"))
    .option("--limit <n>", t("msgCli.reactionsLimitOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("reactions", opts);
    });
}
