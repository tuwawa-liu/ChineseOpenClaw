import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessagePinCommands(message: Command, helpers: MessageCliHelpers) {
  const pins = [
    helpers
      .withMessageBase(
        helpers.withRequiredMessageTarget(message.command("pin").description(t("msgCli.pinDesc"))),
      )
      .requiredOption("--message-id <id>", t("msgCli.pinMessageIdOpt"))
      .action(async (opts) => {
        await helpers.runMessageAction("pin", opts);
      }),
    helpers
      .withMessageBase(
        helpers.withRequiredMessageTarget(
          message.command("unpin").description(t("msgCli.unpinDesc")),
        ),
      )
      .requiredOption("--message-id <id>", t("msgCli.unpinMessageIdOpt"))
      .action(async (opts) => {
        await helpers.runMessageAction("unpin", opts);
      }),
    helpers
      .withMessageBase(
        helpers.withRequiredMessageTarget(
          message.command("pins").description(t("msgCli.pinsDesc")),
        ),
      )
      .option("--limit <n>", t("msgCli.pinsLimitOpt"))
      .action(async (opts) => {
        await helpers.runMessageAction("list-pins", opts);
      }),
  ] as const;

  void pins;
}
