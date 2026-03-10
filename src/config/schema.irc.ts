export const IRC_FIELD_LABELS: Record<string, string> = {
  "channels.irc": "IRC",
  "channels.irc.dmPolicy": "IRC 私信策略",
  "channels.irc.nickserv.enabled": "启用 IRC NickServ",
  "channels.irc.nickserv.service": "IRC NickServ 服务",
  "channels.irc.nickserv.password": "IRC NickServ 密码",
  "channels.irc.nickserv.passwordFile": "IRC NickServ 密码文件",
  "channels.irc.nickserv.register": "IRC NickServ 注册",
  "channels.irc.nickserv.registerEmail": "IRC NickServ 注册邮箱",
};

export const IRC_FIELD_HELP: Record<string, string> = {
  "channels.irc.configWrites":
    "Allow IRC to write config in response to channel events/commands (default: true).",
  "channels.irc.dmPolicy":
    'Direct message access control ("pairing" recommended). "open" requires channels.irc.allowFrom=["*"].',
  "channels.irc.nickserv.enabled":
    "Enable NickServ identify/register after connect (defaults to enabled when password is configured).",
  "channels.irc.nickserv.service": "NickServ service nick (default: NickServ).",
  "channels.irc.nickserv.password": "NickServ password used for IDENTIFY/REGISTER (sensitive).",
  "channels.irc.nickserv.passwordFile": "Optional file path containing NickServ password.",
  "channels.irc.nickserv.register":
    "If true, send NickServ REGISTER on every connect. Use once for initial registration, then disable.",
  "channels.irc.nickserv.registerEmail":
    "Email used with NickServ REGISTER (required when register=true).",
};
