/**
 * Central environment access for the server. Values are read once so that
 * modules never reach for process.env directly, and missing integrations
 * degrade to empty strings instead of crashing unrelated features.
 */
function optional(name: string): string {
  return process.env[name] ?? "";
}

const oauthScopes = optional("OAUTH_SCOPES") || "openid email profile";

export const ENV = {
  appId: optional("APP_ID"),
  ownerOpenId: optional("OWNER_OPEN_ID"),
  analyticsEnabled: optional("ANALYTICS_ENABLED") === "true",
  oAuthStateSalt: optional("OAUTH_STATE_SALT"),
  oauth: {
    clientId: optional("OAUTH_CLIENT_ID"),
    clientSecret: optional("OAUTH_CLIENT_SECRET"),
    authorizeUrl: optional("OAUTH_AUTHORIZATION_URL"),
    tokenUrl: optional("OAUTH_TOKEN_URL"),
    userInfoUrl: optional("OAUTH_USERINFO_URL"),
    scopes: oauthScopes.split(/[\s,]+/).filter(Boolean),
    callbackUri: optional("OAUTH_CALLBACK_URL"),
    portalUrl: optional("OAUTH_PORTAL_URL"),
  },
  forgeApiUrl: optional("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optional("BUILT_IN_FORGE_API_KEY"),
  llmApiKey: optional("LLM_API_KEY"),
  llmBaseUrl: optional("LLM_API_URL"),
} as const;
