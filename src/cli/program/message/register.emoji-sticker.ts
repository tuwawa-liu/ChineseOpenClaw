import type { Command } from "commander";
import { t } from "../../../i18n/index.js";
import { collectOption } from "../helpers.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageEmojiCommands(message: Command, helpers: MessageCliHelpers) {
  const emoji = message.command("emoji").description(t("msgCli.emojiDesc"));

  helpers
    .withMessageBase(emoji.command("list").description(t("msgCli.emojiListDesc")))
    .option("--guild-id <id>", t("msgCli.emojiGuildIdOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("emoji-list", opts);
    });

  helpers
    .withMessageBase(
      emoji
        .command("upload")
        .description(t("msgCli.emojiUploadDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt")),
    )
    .requiredOption("--emoji-name <name>", t("msgCli.emojiNameOpt"))
    .requiredOption("--media <path-or-url>", t("msgCli.emojiMediaOpt"))
    .option("--role-ids <id>", t("msgCli.emojiRoleIdsOpt"), collectOption, [] as string[])
    .action(async (opts) => {
      await helpers.runMessageAction("emoji-upload", opts);
    });
}

export function registerMessageStickerCommands(message: Command, helpers: MessageCliHelpers) {
  const sticker = message.command("sticker").description(t("msgCli.stickerDesc"));

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        sticker.command("send").description(t("msgCli.stickerSendDesc")),
      ),
    )
    .requiredOption("--sticker-id <id>", t("msgCli.stickerIdOpt"), collectOption)
    .option("-m, --message <text>", t("msgCli.stickerMessageOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("sticker", opts);
    });

  helpers
    .withMessageBase(
      sticker
        .command("upload")
        .description(t("msgCli.stickerUploadDesc"))
        .requiredOption("--guild-id <id>", t("msgCli.guildIdOpt")),
    )
    .requiredOption("--sticker-name <name>", t("msgCli.stickerNameOpt"))
    .requiredOption("--sticker-desc <text>", t("msgCli.stickerDescOpt"))
    .requiredOption("--sticker-tags <tags>", t("msgCli.stickerTagsOpt"))
    .requiredOption("--media <path-or-url>", t("msgCli.stickerMediaOpt"))
    .action(async (opts) => {
      await helpers.runMessageAction("sticker-upload", opts);
    });
}
