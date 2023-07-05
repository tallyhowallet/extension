/**
 * Feature flags which are set at build time.
 */
const BuildTimeFlag = {
  SWITCH_RUNTIME_FLAGS: process.env.SWITCH_RUNTIME_FLAGS === "true",
} as const

/**
 * Feature flags which are set at runtime.
 */
export const RuntimeFlag = {
  USE_MAINNET_FORK: process.env.USE_MAINNET_FORK === "true",
  HIDE_IMPORT_DERIVATION_PATH:
    process.env.HIDE_IMPORT_DERIVATION_PATH === "true",
  HIDE_SWAP_REWARDS: process.env.HIDE_SWAP_REWARDS === "true",
  SUPPORT_MULTIPLE_LANGUAGES: process.env.SUPPORT_MULTIPLE_LANGUAGES === "true",
  HIDE_TOKEN_FEATURES: process.env.HIDE_TOKEN_FEATURES === "true",
  SUPPORT_ARBITRUM_NOVA: process.env.SUPPORT_ARBITRUM_NOVA === "true",
  SUPPORT_ACHIEVEMENTS_BANNER:
    process.env.SUPPORT_ACHIEVEMENTS_BANNER === "true",
  SUPPORT_NFT_SEND: process.env.SUPPORT_NFT_SEND === "true",
  SUPPORT_WALLET_CONNECT: process.env.SUPPORT_WALLET_CONNECT === "true",
  SUPPORT_SWAP_QUOTE_REFRESH: process.env.SUPPORT_SWAP_QUOTE_REFRESH === "true",
  SUPPORT_CUSTOM_RPCS: process.env.SUPPORT_CUSTOM_RPCS === "true",
  SUPPORT_UNVERIFIED_ASSET: process.env.SUPPORT_UNVERIFIED_ASSET === "true",
  ENABLE_UPDATED_DAPP_CONNECTIONS:
    process.env.ENABLE_UPDATED_DAPP_CONNECTIONS === "true",
} as const

type BuildTimeFlagType = keyof typeof BuildTimeFlag

export type RuntimeFlagType = keyof typeof RuntimeFlag

export type FeatureFlagType = RuntimeFlagType | BuildTimeFlagType

/**
 * Object with all feature flags. The key is the same as the value.
 */
export const FeatureFlags = Object.keys({
  ...BuildTimeFlag,
  ...RuntimeFlag,
}).reduce((types, flagName) => ({ ...types, [flagName]: flagName }), {}) as {
  [Flag in FeatureFlagType]: Flag
}

/**
 * Checks the status of the feature flag and returns `true` if the flag is set
 * to `true`. Note that some historical flags might have inverted meaning by
 * default (e.g. `HIDE_...`, when set to `true`, might indicate disabling a
 * feature).
 *
 * If the `SWITCH_RUNTIME_FLAGS` feature flag is disabled all flags are read from
 * environment variables.
 *
 * If the `SWITCH_RUNTIME_FLAGS` feature flag is on then the value for runtime
 * flags are read from localStorage first, and, if the value does not exist in
 * localStorage, then it is read from the environment variables.
 *
 * The value for build time flags is always read from environment variables.
 */
export function isEnabled(
  flagName: FeatureFlagType,
  checkBrowserStorage: boolean = BuildTimeFlag.SWITCH_RUNTIME_FLAGS
): boolean {
  // Guard to narrow flag type
  const isBuildTimeFlag = (flag: string): flag is BuildTimeFlagType =>
    flag in BuildTimeFlag

  if (isBuildTimeFlag(flagName)) {
    return BuildTimeFlag[flagName]
  }

  if (checkBrowserStorage) {
    const state = localStorage.getItem(flagName)
    return state !== null ? state === "true" : RuntimeFlag[flagName]
  }

  return RuntimeFlag[flagName]
}

/**
 * Checks the inverse of `isEnabled`; used for clarity as an alternative to
 * `!isEnabled`.
 */
export function isDisabled(
  flagName: FeatureFlagType,
  checkBrowserStorage: boolean = BuildTimeFlag.SWITCH_RUNTIME_FLAGS
): boolean {
  return !isEnabled(flagName, checkBrowserStorage)
}

/**
 * If the flag is enabled, wraps the given value in a single-item array and returns it.
 * Otherwise, returns an empty array.
 *
 * Useful for cases where something is added conditionally to an array
 * based on a feature flag--this function can be called with the spread
 * operator to achieve that conditional wrapping, as in:
 *
 * ```
 * const myArray = [
 *   alwaysIncludeThis,
 *   andThis,
 *   ...wrapIfEnabled(myFeatureFlag, onlyIncludeWhenMyFeatureFlagIsEnabled),
 * ]
 * ```
 */
export function wrapIfEnabled<T>(
  flag: FeatureFlagType,
  valueToWrap: T
): [T] | [] {
  return isEnabled(flag) ? [valueToWrap] : []
}

/**
 * It works in the same way as the wrapIfEnabled function.
 * But checks the inverse of `isEnabled`.
 *
 */
export function wrapIfDisabled<T>(
  flag: FeatureFlagType,
  valueToWrap: T
): [T] | [] {
  return isDisabled(flag) ? [valueToWrap] : []
}
