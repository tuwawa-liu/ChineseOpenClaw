import { DisconnectReason } from "@whiskeysockets/baileys";
import { formatCliCommand } from "../cli/command-format.js";
import { loadConfig } from "../config/config.js";
import { danger, info, success } from "../globals.js";
import { t } from "../i18n/index.js";
import { logInfo } from "../logger.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { resolveWhatsAppAccount } from "./accounts.js";
import { createWaSocket, formatError, logoutWeb, waitForWaConnection } from "./session.js";

export async function loginWeb(
  verbose: boolean,
  waitForConnection?: typeof waitForWaConnection,
  runtime: RuntimeEnv = defaultRuntime,
  accountId?: string,
) {
  const wait = waitForConnection ?? waitForWaConnection;
  const cfg = loadConfig();
  const account = resolveWhatsAppAccount({ cfg, accountId });
  const sock = await createWaSocket(true, verbose, {
    authDir: account.authDir,
  });
  logInfo(t("webLogin.waitingForConnection"), runtime);
  try {
    await wait(sock);
    console.log(success(t("webLogin.linked")));
  } catch (err) {
    const code =
      (err as { error?: { output?: { statusCode?: number } } })?.error?.output?.statusCode ??
      (err as { output?: { statusCode?: number } })?.output?.statusCode;
    if (code === 515) {
      console.log(
        info(
          t("webLogin.restartAfterPairing"),
        ),
      );
      try {
        sock.ws?.close();
      } catch {
        // ignore
      }
      const retry = await createWaSocket(false, verbose, {
        authDir: account.authDir,
      });
      try {
        await wait(retry);
        console.log(success(t("webLogin.linkedAfterRestart")));
        return;
      } finally {
        setTimeout(() => retry.ws?.close(), 500);
      }
    }
    if (code === DisconnectReason.loggedOut) {
      await logoutWeb({
        authDir: account.authDir,
        isLegacyAuthDir: account.isLegacyAuthDir,
        runtime,
      });
      console.error(
        danger(
          t("webLogin.sessionLoggedOut", { command: formatCliCommand("openclaw channels login") }),
        ),
      );
      throw new Error("会话已登出；缓存已清除。请重新运行登录。", { cause: err });
    }
    const formatted = formatError(err);
    console.error(danger(t("webLogin.connectionEndedBeforeOpen", { error: formatted })));
    throw new Error(formatted, { cause: err });
  } finally {
    // Let Baileys flush any final events before closing the socket.
    setTimeout(() => {
      try {
        sock.ws?.close();
      } catch {
        // ignore
      }
    }, 500);
  }
}
