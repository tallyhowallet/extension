export const ONBOARDING_ROOT = "/tab.html#onboarding"

export const ADD_CUSTOM_NETWORK = "/tab.html#add-custom-network"

const OnboardingRoutes = {
  ONBOARDING_START: "/onboarding",
  ADD_WALLET: "/onboarding/add-wallet",
  LEDGER: "/onboarding/ledger",
  SET_PASSWORD: "/onboarding/set-password",
  IMPORT_SEED: "/onboarding/import-seed",
  NEW_SEED: "/onboarding/new-seed",
  VIEW_ONLY_WALLET: "/onboarding/view-only-wallet",
  ONBOARDING_COMPLETE: "/onboarding/done",
} as const

export default OnboardingRoutes
