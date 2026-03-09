import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageDiscordAdminCommands(message: Command, helpers: MessageCliHelpers) {
  const role = message.command("role").description(t("msgCli.roleDesc"));
  helpers
    .withMessageBase(
      role
        .command("info")
        .description(t("msgCli.roleInfoDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("role-info", opts);
    });

  helpers
    .withMessageBase(
      role
        .command("add")
        .description(t("msgCli.roleAddDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt"))
        .requiredOption("--role-id <id>", t("msgCli.roleIdOpt")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("role-add", opts);
    });

  helpers
    .withMessageBase(
      role
        .command("remove")
        .description(t("msgCli.roleRemoveDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt"))
        .requiredOption("--role-id <id>", t("msgCli.roleIdOpt")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("role-remove", opts);
    });

  const channel = message.command("channel").description(t("msgCli.channelActionsDesc"));
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        channel.command("info").description(t("msgCli.channelInfoDesc")),
      ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("channel-info", opts);
    });

  helpers
    .withMessageBase(
      channel
        .command("list")
        .description(t("msgCli.channelListDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("channel-list", opts);
    });

  const member = message.command("member").description(t("msgCli.memberDesc"));
  helpers
    .withMessageBase(
      member
        .command("info")
        .description(t("msgCli.memberInfoDesc"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt")),
    )
    .option("--guild-id <id>", t("msgCli.memberGuildIdOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("member-info", opts);
    });

  const voice = message.command("voice").description(t("msgCli.voiceDesc"));
  helpers
    .withMessageBase(
      voice
        .command("status")
        .description(t("msgCli.voiceStatusDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("voice-status", opts);
    });

  const event = message.command("event").description(t("msgCli.eventDesc"));
  helpers
    .withMessageBase(
      event
        .command("list")
        .description(t("msgCli.eventListDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("event-list", opts);
    });

  helpers
    .withMessageBase(
      event
        .command("create")
        .description(t("msgCli.eventCreateDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--event-name <name>", t("msgCli.eventNameOpt"))
        .requiredOption("--start-time <iso>", t("msgCli.eventStartTimeOpt")),
    )
    .option("--end-time <iso>", t("msgCli.eventEndTimeOpt"))
    .option("--desc <text>", t("msgCli.eventDescOpt"))
    .option("--channel-id <id>", t("msgCli.eventChannelIdOpt"))
    .option("--location <text>", t("msgCli.eventLocationOpt"))
    .option("--event-type <stage|external|voice>", t("msgCli.eventTypeOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("event-create", opts);
    });

  helpers
    .withMessageBase(
      message
        .command("timeout")
        .description(t("msgCli.timeoutDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt")),
    )
    .option("--duration-min <n>", t("msgCli.timeoutDurationOpt"))
    .option("--until <iso>", t("msgCli.timeoutUntilOpt"))
    .option("--reason <text>", t("msgCli.moderationReasonOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("timeout", opts);
    });

  helpers
    .withMessageBase(
      message
        .command("kick")
        .description(t("msgCli.kickDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt")),
    )
    .option("--reason <text>", t("msgCli.moderationReasonOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("kick", opts);
    });

  helpers
    .withMessageBase(
      message
        .command("ban")
        .description(t("msgCli.banDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt"))
        .requiredOption("--user-id <id>", t("msgCli.userIdOpt")),
    )
    .option("--reason <text>", t("msgCli.moderationReasonOpt"))
    .option("--delete-days <n>", t("msgCli.banDeleteDaysOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("ban", opts);
    });
}
