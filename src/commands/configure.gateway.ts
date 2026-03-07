import type { OpenClawConfig } from "../config/config.js";
import { resolveGatewayPort } from "../config/config.js";
import { isValidEnvSecretRefId, type SecretInput } from "../config/types.secrets.js";
import {
  maybeAddTailnetOriginToControlUiAllowedOrigins,
  TAILSCALE_DOCS_LINES,
  TAILSCALE_EXPOSURE_OPTIONS,
  TAILSCALE_MISSING_BIN_NOTE_LINES,
} from "../gateway/gateway-config-prompts.shared.js";
import { t } from "../i18n/index.js";
import { findTailscaleBinary } from "../infra/tailscale.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveDefaultSecretProviderAlias } from "../secrets/ref-contract.js";
import { validateIPv4AddressInput } from "../shared/net/ipv4.js";
import { note } from "../terminal/note.js";
import { buildGatewayAuthConfig } from "./configure.gateway-auth.js";
import { confirm, select, text } from "./configure.shared.js";
import {
  guardCancel,
  normalizeGatewayTokenInput,
  randomToken,
  validateGatewayPasswordInput,
} from "./onboard-helpers.js";

type GatewayAuthChoice = "token" | "password" | "trusted-proxy";
type GatewayTokenInputMode = "plaintext" | "ref";

export async function promptGatewayConfig(
  cfg: OpenClawConfig,
  runtime: RuntimeEnv,
): Promise<{
  config: OpenClawConfig;
  port: number;
  token?: string;
}> {
  const portRaw = guardCancel(
    await text({
      message: t("commands.configGw.portMsg"),
      initialValue: String(resolveGatewayPort(cfg)),
      validate: (value) => (Number.isFinite(Number(value)) ? undefined : t("commands.configGw.invalidPort")),
    }),
    runtime,
  );
  const port = Number.parseInt(String(portRaw), 10);

  let bind = guardCancel(
    await select({
      message: t("commands.configureGateway.bindMode"),
      options: [
        {
          value: "loopback",
          label: t("commands.configureGateway.loopbackLabel"),
          hint: t("commands.configureGateway.loopbackHint"),
        },
        {
          value: "tailnet",
          label: t("commands.configureGateway.tailnetLabel"),
          hint: t("commands.configureGateway.tailnetHint"),
        },
        {
          value: "auto",
          label: t("commands.configureGateway.autoLabel"),
          hint: t("commands.configureGateway.autoHint"),
        },
        {
          value: "lan",
          label: t("commands.configureGateway.lanLabel"),
          hint: t("commands.configureGateway.lanHint"),
        },
        {
          value: "custom",
          label: t("commands.configureGateway.customLabel"),
          hint: t("commands.configureGateway.customHint"),
        },
      ],
    }),
    runtime,
  );

  let customBindHost: string | undefined;
  if (bind === "custom") {
    const input = guardCancel(
      await text({
        message: t("commands.configGw.customIpMsg"),
        placeholder: "192.168.1.100",
        validate: validateIPv4AddressInput,
      }),
      runtime,
    );
    customBindHost = typeof input === "string" ? input : undefined;
  }

  let authMode = guardCancel(
    await select({
      message: t("commands.configGw.authMsg"),
      options: [
        { value: "token", label: t("commands.configGw.tokenLabel"), hint: t("commands.configGw.tokenHint") },
        { value: "password", label: t("commands.configGw.passwordLabel") },
        {
          value: "trusted-proxy",
          label: t("commands.configGw.trustedProxyLabel"),
          hint: t("commands.configGw.trustedProxyHint"),
        },
      ],
      initialValue: "token",
    }),
    runtime,
  ) as GatewayAuthChoice;

  let tailscaleMode = guardCancel(
    await select({
      message: t("commands.configGw.tailscaleMsg"),
      options: [...TAILSCALE_EXPOSURE_OPTIONS],
    }),
    runtime,
  );

  // Detect Tailscale binary before proceeding with serve/funnel setup.
  // Persist the path so getTailnetHostname can reuse it for origin injection.
  let tailscaleBin: string | null = null;
  if (tailscaleMode !== "off") {
    tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      note(TAILSCALE_MISSING_BIN_NOTE_LINES.join("\n"), t("commands.configGw.tailscaleWarning"));
    }
  }

  let tailscaleResetOnExit = false;
  if (tailscaleMode !== "off") {
    note(TAILSCALE_DOCS_LINES.join("\n"), t("commands.configGw.tailscaleTitle"));
    tailscaleResetOnExit = Boolean(
      guardCancel(
        await confirm({
          message: t("commands.configGw.tailscaleResetConfirm"),
          initialValue: false,
        }),
        runtime,
      ),
    );
  }

  if (tailscaleMode !== "off" && bind !== "loopback") {
    note(t("commands.configGw.tailscaleBindNote"), t("commands.configGw.noteTitle"));
    bind = "loopback";
  }

  if (tailscaleMode === "funnel" && authMode !== "password") {
    note(t("commands.configGw.tailscaleFunnelNote"), t("commands.configGw.noteTitle"));
    authMode = "password";
  }

  // trusted-proxy + loopback is valid when the reverse proxy runs on the same
  // host (e.g. cloudflared, nginx, Caddy). trustedProxies must include 127.0.0.1.
  if (authMode === "trusted-proxy" && tailscaleMode !== "off") {
    note(
      t("commands.configGw.trustedProxyIncompat"),
      t("commands.configGw.noteTitle"),
    );
    tailscaleMode = "off";
    tailscaleResetOnExit = false;
  }

  let gatewayToken: SecretInput | undefined;
  let gatewayTokenForCalls: string | undefined;
  let gatewayPassword: string | undefined;
  let trustedProxyConfig:
    | { userHeader: string; requiredHeaders?: string[]; allowUsers?: string[] }
    | undefined;
  let trustedProxies: string[] | undefined;
  let next = cfg;

  if (authMode === "token") {
    const tokenInputMode = guardCancel(
      await select<GatewayTokenInputMode>({
        message: t("commands.configGw.tokenSourceMsg"),
        options: [
          {
            value: "plaintext",
            label: t("commands.configGw.plaintextLabel"),
            hint: t("commands.configGw.plaintextHint"),
          },
          {
            value: "ref",
            label: t("commands.configGw.refLabel"),
            hint: t("commands.configGw.refHint"),
          },
        ],
        initialValue: "plaintext",
      }),
      runtime,
    );
    if (tokenInputMode === "ref") {
      const envVar = guardCancel(
        await text({
          message: t("commands.configGw.envVarMsg"),
          initialValue: "OPENCLAW_GATEWAY_TOKEN",
          placeholder: "OPENCLAW_GATEWAY_TOKEN",
          validate: (value) => {
            const candidate = String(value ?? "").trim();
            if (!isValidEnvSecretRefId(candidate)) {
              return t("commands.configGw.envVarValidate");
            }
            const resolved = process.env[candidate]?.trim();
            if (!resolved) {
              return t("commands.configGw.envVarMissing", { name: candidate });
            }
            return undefined;
          },
        }),
        runtime,
      );
      const envVarName = String(envVar ?? "").trim();
      gatewayToken = {
        source: "env",
        provider: resolveDefaultSecretProviderAlias(cfg, "env", {
          preferFirstProviderForSource: true,
        }),
        id: envVarName,
      };
      note(t("commands.configGw.envVarValidated", { name: envVarName }), t("commands.configGw.gatewayTokenTitle"));
    } else {
      const tokenInput = guardCancel(
        await text({
          message: t("commands.configGw.tokenBlankMsg"),
          initialValue: randomToken(),
        }),
        runtime,
      );
      gatewayTokenForCalls = normalizeGatewayTokenInput(tokenInput) || randomToken();
      gatewayToken = gatewayTokenForCalls;
    }
  }

  if (authMode === "password") {
    const password = guardCancel(
      await text({
        message: t("commands.configGw.passwordMsg"),
        validate: validateGatewayPasswordInput,
      }),
      runtime,
    );
    gatewayPassword = String(password ?? "").trim();
  }

  if (authMode === "trusted-proxy") {
    note(
      t("commands.configGw.trustedProxyNote"),
      t("commands.configGw.trustedProxyAuthTitle"),
    );

    const userHeader = guardCancel(
      await text({
        message: t("commands.configGw.userHeaderMsg"),
        placeholder: "x-forwarded-user",
        initialValue: "x-forwarded-user",
        validate: (value) => (value?.trim() ? undefined : t("commands.configGw.userHeaderRequired")),
      }),
      runtime,
    );

    const requiredHeadersRaw = guardCancel(
      await text({
        message: t("commands.configGw.requiredHeadersMsg"),
        placeholder: "x-forwarded-proto,x-forwarded-host",
      }),
      runtime,
    );
    const requiredHeaders = requiredHeadersRaw
      ? String(requiredHeadersRaw)
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean)
      : [];

    const allowUsersRaw = guardCancel(
      await text({
        message: t("commands.configGw.allowUsersMsg"),
        placeholder: "nick@example.com,admin@company.com",
      }),
      runtime,
    );
    const allowUsers = allowUsersRaw
      ? String(allowUsersRaw)
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const trustedProxiesRaw = guardCancel(
      await text({
        message: t("commands.configGw.trustedProxyIpsMsg"),
        placeholder: "10.0.1.10,192.168.1.5",
        validate: (value) => {
          if (!value || String(value).trim() === "") {
            return t("commands.configGw.trustedProxyIpsRequired");
          }
          return undefined;
        },
      }),
      runtime,
    );
    trustedProxies = String(trustedProxiesRaw)
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);

    trustedProxyConfig = {
      userHeader: String(userHeader).trim(),
      requiredHeaders: requiredHeaders.length > 0 ? requiredHeaders : undefined,
      allowUsers: allowUsers.length > 0 ? allowUsers : undefined,
    };
  }

  const authConfig = buildGatewayAuthConfig({
    existing: next.gateway?.auth,
    mode: authMode,
    token: gatewayToken,
    password: gatewayPassword,
    trustedProxy: trustedProxyConfig,
  });

  next = {
    ...next,
    gateway: {
      ...next.gateway,
      mode: "local",
      port,
      bind,
      auth: authConfig,
      ...(customBindHost && { customBindHost }),
      ...(trustedProxies && { trustedProxies }),
      tailscale: {
        ...next.gateway?.tailscale,
        mode: tailscaleMode,
        resetOnExit: tailscaleResetOnExit,
      },
    },
  };

  next = await maybeAddTailnetOriginToControlUiAllowedOrigins({
    config: next,
    tailscaleMode,
    tailscaleBin,
  });

  return { config: next, port, token: gatewayTokenForCalls };
}
