import {
  buildSingleChannelSecretPromptState,
  formatDocsLink,
  hasConfiguredSecretInput,
  mapAllowFromEntries,
  mergeAllowFromEntries,
  promptSingleChannelSecretInput,
  resolveAccountIdForConfigure,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  setTopLevelChannelDmPolicyWithAllowFrom,
  type SecretInput,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingDmPolicy,
  type OpenClawConfig,
  type WizardPrompter,
} from "openclaw/plugin-sdk/nextcloud-talk";
import {
  listNextcloudTalkAccountIds,
  resolveDefaultNextcloudTalkAccountId,
  resolveNextcloudTalkAccount,
} from "./accounts.js";
import type { CoreConfig, DmPolicy } from "./types.js";

const channel = "nextcloud-talk" as const;

function setNextcloudTalkDmPolicy(cfg: CoreConfig, dmPolicy: DmPolicy): CoreConfig {
  return setTopLevelChannelDmPolicyWithAllowFrom({
    cfg,
    channel: "nextcloud-talk",
    dmPolicy,
    getAllowFrom: (inputCfg) =>
      mapAllowFromEntries(inputCfg.channels?.["nextcloud-talk"]?.allowFrom),
  }) as CoreConfig;
}

function setNextcloudTalkAccountConfig(
  cfg: CoreConfig,
  accountId: string,
  updates: Record<string, unknown>,
): CoreConfig {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        "nextcloud-talk": {
          ...cfg.channels?.["nextcloud-talk"],
          enabled: true,
          ...updates,
        },
      },
    };
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      "nextcloud-talk": {
        ...cfg.channels?.["nextcloud-talk"],
        enabled: true,
        accounts: {
          ...cfg.channels?.["nextcloud-talk"]?.accounts,
          [accountId]: {
            ...cfg.channels?.["nextcloud-talk"]?.accounts?.[accountId],
            enabled: cfg.channels?.["nextcloud-talk"]?.accounts?.[accountId]?.enabled ?? true,
            ...updates,
          },
        },
      },
    },
  };
}

async function noteNextcloudTalkSecretHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) SSH into your Nextcloud server",
      '2) 运行：./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction',
      "3) Copy the shared secret you used in the command",
      "4) Enable the bot in your Nextcloud Talk room settings",
      "提示：你也可以在环境变量中设置 NEXTCLOUD_TALK_BOT_SECRET。",
      `Docs: ${formatDocsLink("/channels/nextcloud-talk", "channels/nextcloud-talk")}`,
    ].join("\n"),
    "Nextcloud Talk 机器人设置",
  );
}

async function noteNextcloudTalkUserIdHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) Check the Nextcloud admin panel for user IDs",
      "2) Or look at the webhook payload logs when someone messages",
      "3) User IDs are typically lowercase usernames in Nextcloud",
      `Docs: ${formatDocsLink("/channels/nextcloud-talk", "channels/nextcloud-talk")}`,
    ].join("\n"),
    "Nextcloud Talk 用户 ID",
  );
}

async function promptNextcloudTalkAllowFrom(params: {
  cfg: CoreConfig;
  prompter: WizardPrompter;
  accountId: string;
}): Promise<CoreConfig> {
  const { cfg, prompter, accountId } = params;
  const resolved = resolveNextcloudTalkAccount({ cfg, accountId });
  const existingAllowFrom = resolved.config.allowFrom ?? [];
  await noteNextcloudTalkUserIdHelp(prompter);

  const parseInput = (value: string) =>
    value
      .split(/[\n,;]+/g)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

  let resolvedIds: string[] = [];
  while (resolvedIds.length === 0) {
    const entry = await prompter.text({
      message: "Nextcloud Talk allowFrom（用户 ID）",
      placeholder: "username",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "必填"),
    });
    resolvedIds = parseInput(String(entry));
    if (resolvedIds.length === 0) {
      await prompter.note("请至少输入一个有效的用户 ID。", "Nextcloud Talk 白名单");
    }
  }

  const merged = [
    ...existingAllowFrom.map((item) => String(item).trim().toLowerCase()).filter(Boolean),
    ...resolvedIds,
  ];
  const unique = mergeAllowFromEntries(undefined, merged);

  return setNextcloudTalkAccountConfig(cfg, accountId, {
    dmPolicy: "allowlist",
    allowFrom: unique,
  });
}

async function promptNextcloudTalkAllowFromForAccount(params: {
  cfg: CoreConfig;
  prompter: WizardPrompter;
  accountId?: string;
}): Promise<CoreConfig> {
  const accountId =
    params.accountId && normalizeAccountId(params.accountId)
      ? (normalizeAccountId(params.accountId) ?? DEFAULT_ACCOUNT_ID)
      : resolveDefaultNextcloudTalkAccountId(params.cfg);
  return promptNextcloudTalkAllowFrom({
    cfg: params.cfg,
    prompter: params.prompter,
    accountId,
  });
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "Nextcloud Talk",
  channel,
  policyKey: "channels.nextcloud-talk.dmPolicy",
  allowFromKey: "channels.nextcloud-talk.allowFrom",
  getCurrent: (cfg) => cfg.channels?.["nextcloud-talk"]?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setNextcloudTalkDmPolicy(cfg as CoreConfig, policy as DmPolicy),
  promptAllowFrom: promptNextcloudTalkAllowFromForAccount as (params: {
    cfg: OpenClawConfig;
    prompter: WizardPrompter;
    accountId?: string | undefined;
  }) => Promise<OpenClawConfig>,
};

export const nextcloudTalkOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listNextcloudTalkAccountIds(cfg as CoreConfig).some((accountId) => {
      const account = resolveNextcloudTalkAccount({ cfg: cfg as CoreConfig, accountId });
      return Boolean(account.secret && account.baseUrl);
    });
    return {
      channel,
      configured,
      statusLines: [`Nextcloud Talk：${configured ? "已配置" : "需要设置"}`],
      selectionHint: configured ? "已配置" : "自托管聊天",
      quickstartScore: configured ? 1 : 5,
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom,
  }) => {
    const defaultAccountId = resolveDefaultNextcloudTalkAccountId(cfg as CoreConfig);
    const accountId = await resolveAccountIdForConfigure({
      cfg,
      prompter,
      label: "Nextcloud Talk",
      accountOverride: accountOverrides["nextcloud-talk"],
      shouldPromptAccountIds,
      listAccountIds: listNextcloudTalkAccountIds as (cfg: OpenClawConfig) => string[],
      defaultAccountId,
    });

    let next = cfg as CoreConfig;
    const resolvedAccount = resolveNextcloudTalkAccount({
      cfg: next,
      accountId,
    });
    const accountConfigured = Boolean(resolvedAccount.secret && resolvedAccount.baseUrl);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
    const hasConfigSecret = Boolean(
      hasConfiguredSecretInput(resolvedAccount.config.botSecret) ||
      resolvedAccount.config.botSecretFile,
    );
    const secretPromptState = buildSingleChannelSecretPromptState({
      accountConfigured,
      hasConfigToken: hasConfigSecret,
      allowEnv,
      envValue: process.env.NEXTCLOUD_TALK_BOT_SECRET,
    });

    let baseUrl = resolvedAccount.baseUrl;
    if (!baseUrl) {
      baseUrl = String(
        await prompter.text({
          message: "输入 Nextcloud 实例 URL（例如 https://cloud.example.com）",
          validate: (value) => {
            const v = String(value ?? "").trim();
            if (!v) {
              return "必填";
            }
            if (!v.startsWith("http://") && !v.startsWith("https://")) {
              return "URL 必须以 http:// 或 https:// 开头";
            }
            return undefined;
          },
        }),
      ).trim();
    }

    let secret: SecretInput | null = null;
    if (!accountConfigured) {
      await noteNextcloudTalkSecretHelp(prompter);
    }

    const secretResult = await promptSingleChannelSecretInput({
      cfg: next,
      prompter,
      providerHint: "nextcloud-talk",
      credentialLabel: "bot secret",
      accountConfigured: secretPromptState.accountConfigured,
      canUseEnv: secretPromptState.canUseEnv,
      hasConfigToken: secretPromptState.hasConfigToken,
      envPrompt: "NEXTCLOUD_TALK_BOT_SECRET detected. Use env var?",
      keepPrompt: "Nextcloud Talk 机器人密钥已配置。保留吗？",
      inputPrompt: "输入 Nextcloud Talk 机器人密钥",
      preferredEnvVar: "NEXTCLOUD_TALK_BOT_SECRET",
    });
    if (secretResult.action === "set") {
      secret = secretResult.value;
    }

    if (secretResult.action === "use-env" || secret || baseUrl !== resolvedAccount.baseUrl) {
      next = setNextcloudTalkAccountConfig(next, accountId, {
        baseUrl,
        ...(secret ? { botSecret: secret } : {}),
      });
    }

    const existingApiUser = resolvedAccount.config.apiUser?.trim();
    const existingApiPasswordConfigured = Boolean(
      hasConfiguredSecretInput(resolvedAccount.config.apiPassword) ||
      resolvedAccount.config.apiPasswordFile,
    );
    const configureApiCredentials = await prompter.confirm({
      message: "配置可选的 Nextcloud Talk API 凭据以进行房间查找？",
      initialValue: Boolean(existingApiUser && existingApiPasswordConfigured),
    });
    if (configureApiCredentials) {
      const apiUser = String(
        await prompter.text({
          message: "Nextcloud Talk API 用户",
          initialValue: existingApiUser,
          validate: (value) => (String(value ?? "").trim() ? undefined : "必填"),
        }),
      ).trim();
      const apiPasswordResult = await promptSingleChannelSecretInput({
        cfg: next,
        prompter,
        providerHint: "nextcloud-talk-api",
        credentialLabel: "API password",
        ...buildSingleChannelSecretPromptState({
          accountConfigured: Boolean(existingApiUser && existingApiPasswordConfigured),
          hasConfigToken: existingApiPasswordConfigured,
          allowEnv: false,
        }),
        envPrompt: "",
        keepPrompt: "Nextcloud Talk API 密码已配置。保留吗？",
        inputPrompt: "输入 Nextcloud Talk API 密码",
        preferredEnvVar: "NEXTCLOUD_TALK_API_PASSWORD",
      });
      const apiPassword = apiPasswordResult.action === "set" ? apiPasswordResult.value : undefined;
      next = setNextcloudTalkAccountConfig(next, accountId, {
        apiUser,
        ...(apiPassword ? { apiPassword } : {}),
      });
    }

    if (forceAllowFrom) {
      next = await promptNextcloudTalkAllowFrom({
        cfg: next,
        prompter,
        accountId,
      });
    }

    return { cfg: next, accountId };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      "nextcloud-talk": { ...cfg.channels?.["nextcloud-talk"], enabled: false },
    },
  }),
};
