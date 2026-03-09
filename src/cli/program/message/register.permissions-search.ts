import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import { collectOption } from "../helpers.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessagePermissionsCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("permissions").description(t("msgCli.permissionsDesc")),
      ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("permissions", opts);
    });
}

export function registerMessageSearchCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(message.command("search").description(t("msgCli.searchDesc")))
    .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
    .requiredOption("--query <text>", t("msgCli.searchQueryOpt"))
    .option("--channel-id <id>", t("msgCli.searchChannelIdOpt"))
    .option("--channel-ids <id>", t("msgCli.searchChannelIdsOpt"), collectOption, [] as string[])
    .option("--author-id <id>", t("msgCli.searchAuthorIdOpt"))
    .option("--author-ids <id>", t("msgCli.searchAuthorIdsOpt"), collectOption, [] as string[])
    .option("--limit <n>", t("msgCli.searchLimitOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("search", opts);
    });
}
