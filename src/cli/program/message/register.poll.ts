import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import { collectOption } from "../helpers.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessagePollCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(message.command("poll").description(t("msgCli.pollDesc"))),
    )
    .requiredOption("--poll-question <text>", t("msgCli.pollQuestionOpt"))
    .option("--poll-option <choice>", t("msgCli.pollOptionOpt"), collectOption, [] as string[])
    .option("--poll-multi", t("msgCli.pollMultiOpt"), false)
    .option("--poll-duration-hours <n>", t("msgCli.pollDurationHoursOpt"))
    .option("--poll-duration-seconds <n>", t("msgCli.pollDurationSecondsOpt"))
    .option("--poll-anonymous", t("msgCli.pollAnonymousOpt"), false)
    .option("--poll-public", t("msgCli.pollPublicOpt"), false)
    .option("-m, --message <text>", t("msgCli.pollMessageOpt"))
    .option("--silent", t("msgCli.pollSilentOpt"), false)
    .option("--thread-id <id>", t("msgCli.pollThreadIdOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("poll", opts);
    });
}
