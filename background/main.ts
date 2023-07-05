import browser, { runtime } from "webextension-polyfill"
import { alias, wrapStore } from "webext-redux"
import deepDiff from "webext-redux/lib/strategies/deepDiff/diff"
import { configureStore, isPlain, Middleware } from "@reduxjs/toolkit"
import { devToolsEnhancer } from "@redux-devtools/remote"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import { debounce } from "lodash"
import { utils } from "ethers"

import {
  decodeJSON,
  encodeJSON,
  getEthereumNetwork,
  isProbablyEVMAddress,
  normalizeEVMAddress,
  sameEVMAddress,
  wait,
} from "./lib/utils"

import {
  BaseService,
  ChainService,
  EnrichmentService,
  IndexingService,
  InternalEthereumProviderService,
  KeyringService,
  NameService,
  PreferenceService,
  ProviderBridgeService,
  TelemetryService,
  ServiceCreatorFunction,
  DoggoService,
  LedgerService,
  SigningService,
  NFTsService,
  WalletConnectService,
  AnalyticsService,
  getNoopService,
} from "./services"

import { HexString, KeyringTypes, NormalizedEVMAddress } from "./types"
import { EVMNetwork, SignedTransaction } from "./networks"
import { AccountBalance, AddressOnNetwork, NameOnNetwork } from "./accounts"
import { Eligible } from "./services/doggo/types"

import rootReducer from "./redux-slices"
import {
  AccountType,
  deleteAccount,
  loadAccount,
  updateAccountBalance,
  updateAccountName,
  updateENSAvatar,
} from "./redux-slices/accounts"
import {
  assetsLoaded,
  newPricePoints,
  refreshAsset,
  removeAssetData,
} from "./redux-slices/assets"
import {
  setEligibility,
  setEligibilityLoading,
  setReferrer,
  setReferrerStats,
} from "./redux-slices/claim"
import {
  emitter as keyringSliceEmitter,
  keyringLocked,
  keyringUnlocked,
  updateKeyrings,
  setKeyringToVerify,
} from "./redux-slices/keyrings"
import { blockSeen, setEVMNetworks } from "./redux-slices/networks"
import {
  initializationLoadingTimeHitLimit,
  emitter as uiSliceEmitter,
  setDefaultWallet,
  setSelectedAccount,
  setNewSelectedAccount,
  setSnackbarMessage,
  setAccountsSignerSettings,
  toggleCollectAnalytics,
  setShowAnalyticsNotification,
  setSelectedNetwork,
  setShownDismissableItems,
  dismissableItemMarkedAsShown,
} from "./redux-slices/ui"
import {
  estimatedFeesPerGas,
  emitter as transactionConstructionSliceEmitter,
  transactionRequest,
  updateTransactionData,
  clearTransactionState,
  TransactionConstructionStatus,
  rejectTransactionSignature,
  transactionSigned,
  clearCustomGas,
  updateRollupEstimates,
} from "./redux-slices/transaction-construction"
import { selectDefaultNetworkFeeSettings } from "./redux-slices/selectors/transactionConstructionSelectors"
import { allAliases } from "./redux-slices/utils"
import {
  requestPermission,
  emitter as providerBridgeSliceEmitter,
  initializePermissions,
  revokePermissionsForAddress,
} from "./redux-slices/dapp"
import logger from "./lib/logger"
import {
  rejectDataSignature,
  clearSigningState,
  signedTypedData,
  signedData as signedDataAction,
  signingSliceEmitter,
  typedDataRequest,
  signDataRequest,
} from "./redux-slices/signing"

import { SignTypedDataRequest, MessageSigningRequest } from "./utils/signing"
import {
  emitter as earnSliceEmitter,
  setVaultsAsStale,
} from "./redux-slices/earn"
import {
  removeDevice,
  resetLedgerState,
  setDeviceConnectionStatus,
  setUsbDeviceCount,
} from "./redux-slices/ledger"
import { OPTIMISM, USD } from "./constants"
import { clearApprovalInProgress, clearSwapQuote } from "./redux-slices/0x-swap"
import {
  AccountSigner,
  SignatureResponse,
  TXSignatureResponse,
} from "./services/signing"
import { ReferrerStats } from "./services/doggo/db"
import {
  migrateReduxState,
  REDUX_STATE_VERSION,
} from "./redux-slices/migrations"
import {
  PermissionMap,
  ValidatedAddEthereumChainParameter,
} from "./services/provider-bridge/utils"
import { TALLY_INTERNAL_ORIGIN } from "./services/internal-ethereum-provider/constants"
import {
  ActivityDetail,
  addActivity,
  initializeActivities,
  initializeActivitiesForAccount,
  removeActivities,
} from "./redux-slices/activities"
import { selectActivitesHashesForEnrichment } from "./redux-slices/selectors"
import { getActivityDetails } from "./redux-slices/utils/activities-utils"
import { getRelevantTransactionAddresses } from "./services/enrichment/utils"
import { AccountSignerWithId } from "./signing"
import { AnalyticsPreferences } from "./services/preferences/types"
import {
  AnyAssetMetadata,
  assetAmountToDesiredDecimals,
  convertAssetAmountViaPricePoint,
  isSmartContractFungibleAsset,
  SmartContractFungibleAsset,
} from "./assets"
import { FeatureFlags, isEnabled } from "./features"
import { NFTCollection } from "./nfts"
import {
  initializeNFTs,
  updateNFTsCollections,
  emitter as nftsSliceEmitter,
  updateNFTs,
  deleteNFTsForAddress,
  updateIsReloading,
  deleteTransferredNFTs,
} from "./redux-slices/nfts"
import AbilitiesService from "./services/abilities"
import {
  setAbilitiesForAddress,
  updateAbility,
  addAccount as addAccountFilter,
  deleteAccount as deleteAccountFilter,
  deleteAbilitiesForAccount,
  initAbilities,
} from "./redux-slices/abilities"
import { AddChainRequestData } from "./services/provider-bridge"
import {
  AnalyticsEvent,
  isOneTimeAnalyticsEvent,
  OneTimeAnalyticsEvent,
} from "./lib/posthog"
import {
  isBuiltInNetworkBaseAsset,
  isSameAsset,
} from "./redux-slices/utils/asset-utils"
import { getPricePoint, getTokenPrices } from "./lib/prices"
import { DismissableItem } from "./services/preferences"

// This sanitizer runs on store and action data before serializing for remote
// redux devtools. The goal is to end up with an object that is directly
// JSON-serializable and deserializable; the remote end will display the
// resulting objects without additional processing or decoding logic.
const devToolsSanitizer = (input: unknown) => {
  switch (typeof input) {
    // We can make use of encodeJSON instead of recursively looping through
    // the input
    case "bigint":
    case "object":
      return JSON.parse(encodeJSON(input))
    // We only need to sanitize bigints and objects that may or may not contain
    // them.
    default:
      return input
  }
}

const persistStoreFn = <T>(state: T) => {
  if (process.env.WRITE_REDUX_CACHE === "true") {
    // Browser extension storage supports JSON natively, despite that we have
    // to stringify to preserve BigInts
    browser.storage.local.set({
      state: encodeJSON(state),
      version: REDUX_STATE_VERSION,
    })
  }
}

const persistStoreState = debounce(persistStoreFn, 50, {
  trailing: true,
  maxWait: 50,
})

const reduxCache: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  const state = store.getState()

  persistStoreState(state)
  return result
}

// Declared out here so ReduxStoreType can be used in Main.store type
// declaration.
const initializeStore = (preloadedState = {}, main: Main) =>
  configureStore({
    preloadedState,
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      const middleware = getDefaultMiddleware({
        serializableCheck: {
          isSerializable: (value: unknown) =>
            isPlain(value) || typeof value === "bigint",
        },
        thunk: { extraArgument: { main } },
      })

      // It might be tempting to use an array with `...` destructuring, but
      // unfortunately this fails to preserve important type information from
      // `getDefaultMiddleware`. `push` and `pull` preserve the type
      // information in `getDefaultMiddleware`, including adjustments to the
      // dispatch function type, but as a tradeoff nothing added this way can
      // further modify the type signature. For now, that's fine, as these
      // middlewares don't change acceptable dispatch types.
      //
      // Process aliases before all other middleware, and cache the redux store
      // after all middleware gets a chance to run.
      middleware.unshift(alias(allAliases))
      middleware.push(reduxCache)

      return middleware
    },
    devTools: false,
    enhancers:
      process.env.NODE_ENV === "development"
        ? [
            devToolsEnhancer({
              hostname: "localhost",
              port: 8000,
              realtime: true,
              actionSanitizer: devToolsSanitizer,
              stateSanitizer: devToolsSanitizer,
            }),
          ]
        : [],
  })

type ReduxStoreType = ReturnType<typeof initializeStore>

export const popupMonitorPortName = "popup-monitor"

// TODO Rename ReduxService or CoordinationService, move to services/, etc.
export default class Main extends BaseService<never> {
  /**
   * The redux store for the wallet core. Note that the redux store is used to
   * render the UI (via webext-redux), but it is _not_ the source of truth.
   * Services interact with the various external and internal components and
   * create persisted state, and the redux store is simply a view onto those
   * pieces of canonical state.
   */
  store: ReduxStoreType

  static create: ServiceCreatorFunction<never, Main, []> = async () => {
    const preferenceService = PreferenceService.create()
    const keyringService = KeyringService.create()
    const chainService = ChainService.create(preferenceService, keyringService)
    const indexingService = IndexingService.create(
      preferenceService,
      chainService
    )
    const nameService = NameService.create(chainService, preferenceService)
    const enrichmentService = EnrichmentService.create(
      chainService,
      indexingService,
      nameService
    )
    const internalEthereumProviderService =
      InternalEthereumProviderService.create(chainService, preferenceService)
    const providerBridgeService = ProviderBridgeService.create(
      internalEthereumProviderService,
      preferenceService
    )
    const doggoService = DoggoService.create(chainService, indexingService)

    const telemetryService = TelemetryService.create()

    const ledgerService = LedgerService.create()

    const signingService = SigningService.create(
      keyringService,
      ledgerService,
      chainService
    )

    const analyticsService = AnalyticsService.create(preferenceService)

    const nftsService = NFTsService.create(chainService)

    const abilitiesService = AbilitiesService.create(
      chainService,
      ledgerService
    )

    const walletConnectService = isEnabled(FeatureFlags.SUPPORT_WALLET_CONNECT)
      ? WalletConnectService.create(
          providerBridgeService,
          internalEthereumProviderService,
          preferenceService,
          chainService
        )
      : getNoopService<WalletConnectService>()

    let savedReduxState = {}
    // Setting READ_REDUX_CACHE to false will start the extension with an empty
    // initial state, which can be useful for development
    if (process.env.READ_REDUX_CACHE === "true") {
      const { state, version } = await browser.storage.local.get([
        "state",
        "version",
      ])

      if (state) {
        const restoredState = decodeJSON(state)
        if (typeof restoredState === "object" && restoredState !== null) {
          // If someone managed to sneak JSON that decodes to typeof "object"
          // but isn't a Record<string, unknown>, there is a very large
          // problem...
          savedReduxState = migrateReduxState(
            restoredState as Record<string, unknown>,
            version || undefined
          )
        } else {
          throw new Error(`Unexpected JSON persisted for state: ${state}`)
        }
      } else {
        // Should be false if you don't want new users to see the modal
        window.localStorage.setItem("modal_meet_taho", "false")
      }
    }

    return new this(
      savedReduxState,
      await preferenceService,
      await chainService,
      await enrichmentService,
      await indexingService,
      await keyringService,
      await nameService,
      await internalEthereumProviderService,
      await providerBridgeService,
      await doggoService,
      await telemetryService,
      await ledgerService,
      await signingService,
      await analyticsService,
      await nftsService,
      await walletConnectService,
      await abilitiesService
    )
  }

  private constructor(
    savedReduxState: Record<string, unknown>,
    /**
     * A promise to the preference service, a dependency for most other services.
     * The promise will be resolved when the service is initialized.
     */
    private preferenceService: PreferenceService,
    /**
     * A promise to the chain service, keeping track of base asset balances,
     * transactions, and network status. The promise will be resolved when the
     * service is initialized.
     */
    private chainService: ChainService,
    /**
     *
     */
    private enrichmentService: EnrichmentService,
    /**
     * A promise to the indexing service, keeping track of token balances and
     * prices. The promise will be resolved when the service is initialized.
     */
    private indexingService: IndexingService,
    /**
     * A promise to the keyring service, which stores key material, derives
     * accounts, and signs messagees and transactions. The promise will be
     * resolved when the service is initialized.
     */
    private keyringService: KeyringService,
    /**
     * A promise to the name service, responsible for resolving names to
     * addresses and content.
     */
    private nameService: NameService,
    /**
     * A promise to the internal ethereum provider service, which acts as
     * web3 / ethereum provider for the internal and external dApps to use.
     */
    private internalEthereumProviderService: InternalEthereumProviderService,
    /**
     * A promise to the provider bridge service, handling and validating
     * the communication coming from dApps according to EIP-1193 and some tribal
     * knowledge.
     */
    private providerBridgeService: ProviderBridgeService,
    /**
     * A promise to the claim service, which saves the eligibility data
     * for efficient storage and retrieval.
     */
    private doggoService: DoggoService,
    /**
     * A promise to the telemetry service, which keeps track of extension
     * storage usage and (eventually) other statistics.
     */
    private telemetryService: TelemetryService,

    /**
     * A promise to the Ledger service, handling the communication
     * with attached Ledger device according to ledgerjs examples and some
     * tribal knowledge. ;)
     */
    private ledgerService: LedgerService,

    /**
     * A promise to the signing service which will route operations between the UI
     * and the exact signing services.
     */
    private signingService: SigningService,

    /**
     * A promise to the analytics service which will be responsible for listening
     * to events and dispatching to our analytics backend
     */
    private analyticsService: AnalyticsService,

    /**
     * A promise to the NFTs service which takes care of NFTs data, fetching, updating
     * details and prices of NFTs for imported accounts.
     */
    private nftsService: NFTsService,

    /**
     * A promise to the Wallet Connect service which takes care of handling wallet connect
     * protocol and communication.
     */
    private walletConnectService: WalletConnectService,

    /**
     * A promise to the Abilities service which takes care of fetching and storing abilities
     */
    private abilitiesService: AbilitiesService
  ) {
    super({
      initialLoadWaitExpired: {
        schedule: { delayInMinutes: 2.5 },
        handler: () => this.store.dispatch(initializationLoadingTimeHitLimit()),
      },
    })

    // Start up the redux store and set it up for proxying.
    this.store = initializeStore(savedReduxState, this)

    wrapStore(this.store, {
      serializer: encodeJSON,
      deserializer: decodeJSON,
      diffStrategy: deepDiff,
      dispatchResponder: async (
        dispatchResult: Promise<unknown>,
        send: (param: { error: string | null; value: unknown | null }) => void
      ) => {
        try {
          send({
            error: null,
            value: encodeJSON(await dispatchResult),
          })
        } catch (error) {
          logger.error(
            "Error awaiting and dispatching redux store result: ",
            error
          )
          send({
            error: encodeJSON(error),
            value: null,
          })
        }
      },
    })

    this.initializeRedux()
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService()

    const servicesToBeStarted = [
      this.preferenceService.startService(),
      this.chainService.startService(),
      this.indexingService.startService(),
      this.enrichmentService.startService(),
      this.keyringService.startService(),
      this.nameService.startService(),
      this.internalEthereumProviderService.startService(),
      this.providerBridgeService.startService(),
      this.doggoService.startService(),
      this.telemetryService.startService(),
      this.ledgerService.startService(),
      this.signingService.startService(),
      this.analyticsService.startService(),
      this.nftsService.startService(),
      this.walletConnectService.startService(),
      this.abilitiesService.startService(),
    ]

    await Promise.all(servicesToBeStarted)
  }

  protected override async internalStopService(): Promise<void> {
    const servicesToBeStopped = [
      this.preferenceService.stopService(),
      this.chainService.stopService(),
      this.indexingService.stopService(),
      this.enrichmentService.stopService(),
      this.keyringService.stopService(),
      this.nameService.stopService(),
      this.internalEthereumProviderService.stopService(),
      this.providerBridgeService.stopService(),
      this.doggoService.stopService(),
      this.telemetryService.stopService(),
      this.ledgerService.stopService(),
      this.signingService.stopService(),
      this.analyticsService.stopService(),
      this.nftsService.stopService(),
      this.walletConnectService.stopService(),
      this.abilitiesService.stopService(),
    ]

    await Promise.all(servicesToBeStopped)
    await super.internalStopService()
  }

  async initializeRedux(): Promise<void> {
    this.connectIndexingService()
    this.connectKeyringService()
    this.connectNameService()
    this.connectInternalEthereumProviderService()
    this.connectProviderBridgeService()
    this.connectPreferenceService()
    this.connectEnrichmentService()
    this.connectDoggoService()
    this.connectTelemetryService()
    this.connectLedgerService()
    this.connectSigningService()
    this.connectAnalyticsService()
    this.connectWalletConnectService()
    this.connectAbilitiesService()
    this.connectNFTsService()

    await this.connectChainService()

    // FIXME Should no longer be necessary once transaction queueing enters the
    // FIXME picture.
    this.store.dispatch(
      clearTransactionState(TransactionConstructionStatus.Idle)
    )

    this.store.dispatch(clearApprovalInProgress())

    this.connectPopupMonitor()
  }

  async addAccount(addressNetwork: AddressOnNetwork): Promise<void> {
    await this.chainService.addAccountToTrack(addressNetwork)
  }

  addOrEditAddressName({
    address,
    network,
    name,
  }: AddressOnNetwork & { name: string }): void {
    this.preferenceService.addOrEditNameInAddressBook({
      address,
      network,
      name,
    })
    this.analyticsService.sendAnalyticsEvent(AnalyticsEvent.ACCOUNT_NAME_EDITED)
  }

  async removeAccount(
    address: HexString,
    signer: AccountSigner,
    lastAddressInAccount: boolean
  ): Promise<void> {
    this.store.dispatch(deleteAccount(address))

    if (signer.type !== AccountType.ReadOnly && lastAddressInAccount) {
      await this.preferenceService.deleteAccountSignerSettings(signer)
    }

    if (signer.type === "ledger" && lastAddressInAccount) {
      this.store.dispatch(removeDevice(signer.deviceID))
    }

    this.store.dispatch(removeActivities(address))

    // remove NFTs
    this.store.dispatch(deleteNFTsForAddress(address))
    await this.nftsService.removeNFTsForAddress(address)

    // remove abilities
    if (signer.type !== AccountType.ReadOnly) {
      await this.abilitiesService.deleteAbilitiesForAccount(address)
    }
    // remove dApp premissions
    this.store.dispatch(revokePermissionsForAddress(address))
    await this.providerBridgeService.revokePermissionsForAddress(address)
    // TODO Adjust to handle specific network.
    await this.signingService.removeAccount(address, signer.type)

    this.nameService.removeAccount(address)

    // remove discovery tx hash for custom asset
    this.indexingService.removeDiscoveryTxHash(address)
  }

  async importLedgerAccounts(
    accounts: Array<{
      path: string
      address: string
    }>
  ): Promise<void> {
    const trackedNetworks = await this.chainService.getTrackedNetworks()
    await Promise.all(
      accounts.map(async ({ path, address }) => {
        await this.ledgerService.saveAddress(path, address)

        await Promise.all(
          trackedNetworks.map(async (network) => {
            const addressNetwork = {
              address,
              network,
            }
            await this.chainService.addAccountToTrack(addressNetwork)
            this.abilitiesService.getNewAccountAbilities(address)

            this.store.dispatch(loadAccount(addressNetwork))
          })
        )
      })
    )
    this.store.dispatch(
      setNewSelectedAccount({
        address: accounts[0].address,
        network:
          await this.internalEthereumProviderService.getCurrentOrDefaultNetworkForOrigin(
            TALLY_INTERNAL_ORIGIN
          ),
      })
    )
  }

  async deriveLedgerAddress(
    deviceID: string,
    derivationPath: string
  ): Promise<string> {
    return this.signingService.deriveAddress({
      type: "ledger",
      deviceID,
      path: derivationPath,
    })
  }

  async connectLedger(): Promise<string | null> {
    return this.ledgerService.refreshConnectedLedger()
  }

  async getAccountEthBalanceUncached(
    addressNetwork: AddressOnNetwork
  ): Promise<bigint> {
    const accountBalance = await this.chainService.getLatestBaseAccountBalance(
      addressNetwork
    )

    return accountBalance.assetAmount.amount
  }

  async enrichActivitiesForSelectedAccount(): Promise<void> {
    const addressNetwork = this.store.getState().ui.selectedAccount
    if (addressNetwork) {
      await this.enrichActivities(addressNetwork)
    }
  }

  async enrichActivities(addressNetwork: AddressOnNetwork): Promise<void> {
    const accountsToTrack = await this.chainService.getAccountsToTrack()
    const activitiesToEnrich = selectActivitesHashesForEnrichment(
      this.store.getState()
    )

    activitiesToEnrich.forEach(async (txHash) => {
      const transaction = await this.chainService.getTransaction(
        addressNetwork.network,
        txHash
      )
      const enrichedTransaction =
        await this.enrichmentService.enrichTransaction(transaction, 2)

      this.store.dispatch(
        addActivity({
          transaction: enrichedTransaction,
          forAccounts: getRelevantTransactionAddresses(
            enrichedTransaction,
            accountsToTrack
          ),
        })
      )
    })
  }

  async connectChainService(): Promise<void> {
    // Initialize activities for all accounts once on and then
    // initialize for each account when it is needed
    this.chainService.emitter.on("initializeActivities", async (payload) => {
      this.store.dispatch(initializeActivities(payload))
      await this.enrichActivitiesForSelectedAccount()

      this.chainService.emitter.on(
        "initializeActivitiesForAccount",
        async (payloadForAccount) => {
          this.store.dispatch(initializeActivitiesForAccount(payloadForAccount))
          await this.enrichActivitiesForSelectedAccount()
        }
      )

      // Set up initial state.
      const existingAccounts = await this.chainService.getAccountsToTrack()
      existingAccounts.forEach(async (addressNetwork) => {
        // Mark as loading and wire things up.
        this.store.dispatch(loadAccount(addressNetwork))

        // Force a refresh of the account balance to populate the store.
        this.chainService.getLatestBaseAccountBalance(addressNetwork)
      })
    })

    // Wire up chain service to account slice.
    this.chainService.emitter.on(
      "accountsWithBalances",
      (accountWithBalance) => {
        // The first account balance update will transition the account to loading.
        this.store.dispatch(updateAccountBalance(accountWithBalance))
      }
    )

    this.chainService.emitter.on("supportedNetworks", (supportedNetworks) => {
      this.store.dispatch(setEVMNetworks(supportedNetworks))
    })

    this.chainService.emitter.on("block", (block) => {
      this.store.dispatch(blockSeen(block))
    })

    this.chainService.emitter.on("transactionSend", () => {
      this.store.dispatch(
        setSnackbarMessage("Transaction signed, broadcasting...")
      )
      this.store.dispatch(
        clearTransactionState(TransactionConstructionStatus.Idle)
      )
    })

    earnSliceEmitter.on("earnDeposit", (message) => {
      this.store.dispatch(setSnackbarMessage(message))
    })

    this.chainService.emitter.on("transactionSendFailure", () => {
      this.store.dispatch(
        setSnackbarMessage("Transaction failed to broadcast.")
      )
    })

    transactionConstructionSliceEmitter.on(
      "updateTransaction",
      async (transaction) => {
        const { network } = transaction

        const {
          values: { maxFeePerGas, maxPriorityFeePerGas },
        } = selectDefaultNetworkFeeSettings(this.store.getState())

        const { transactionRequest: populatedRequest, gasEstimationError } =
          await this.chainService.populatePartialTransactionRequest(
            network,
            { ...transaction },
            { maxFeePerGas, maxPriorityFeePerGas }
          )

        // Create promise to pass into Promise.race
        const getAnnotation = async () => {
          const { annotation } =
            await this.enrichmentService.enrichTransactionSignature(
              network,
              populatedRequest,
              2 /* TODO desiredDecimals should be configurable */
            )
          return annotation
        }

        const maybeEnrichedAnnotation = await Promise.race([
          getAnnotation(),
          // Wait 10 seconds before discarding enrichment
          wait(10_000),
        ])

        if (maybeEnrichedAnnotation) {
          populatedRequest.annotation = maybeEnrichedAnnotation
        }

        if (typeof gasEstimationError === "undefined") {
          this.store.dispatch(
            transactionRequest({
              transactionRequest: populatedRequest,
              transactionLikelyFails: false,
            })
          )
        } else {
          this.store.dispatch(
            transactionRequest({
              transactionRequest: populatedRequest,
              transactionLikelyFails: true,
            })
          )
        }
      }
    )

    transactionConstructionSliceEmitter.on(
      "broadcastSignedTransaction",
      async (transaction: SignedTransaction) => {
        this.chainService.broadcastSignedTransaction(transaction)
      }
    )

    transactionConstructionSliceEmitter.on(
      "requestSignature",
      async ({ request, accountSigner }) => {
        try {
          const signedTransactionResult =
            await this.signingService.signTransaction(request, accountSigner)
          await this.store.dispatch(transactionSigned(signedTransactionResult))
          this.analyticsService.sendAnalyticsEvent(
            AnalyticsEvent.TRANSACTION_SIGNED,
            {
              chainId: request.chainID,
            }
          )
        } catch (exception) {
          logger.error("Error signing transaction", exception)
          this.store.dispatch(
            clearTransactionState(TransactionConstructionStatus.Idle)
          )
        }
      }
    )
    signingSliceEmitter.on(
      "requestSignTypedData",
      async ({ typedData, account, accountSigner }) => {
        try {
          const signedData = await this.signingService.signTypedData({
            typedData,
            account,
            accountSigner,
          })
          this.store.dispatch(signedTypedData(signedData))
        } catch (err) {
          logger.error("Error signing typed data", typedData, "error: ", err)
          this.store.dispatch(clearSigningState)
        }
      }
    )
    signingSliceEmitter.on(
      "requestSignData",
      async ({ rawSigningData, account, accountSigner }) => {
        const signedData = await this.signingService.signData(
          account,
          rawSigningData,
          accountSigner
        )
        this.store.dispatch(signedDataAction(signedData))
      }
    )

    this.chainService.emitter.on(
      "blockPrices",
      async ({ blockPrices, network }) => {
        if (network.chainID === OPTIMISM.chainID) {
          const { transactionRequest: currentTransactionRequest } =
            this.store.getState().transactionConstruction
          if (currentTransactionRequest?.network.chainID === OPTIMISM.chainID) {
            // If there is a currently pending transaction request on Optimism,
            // we need to update its L1 rollup fee as well as the current estimated fees per gas
            const estimatedRollupFee =
              await this.chainService.estimateL1RollupFeeForOptimism(
                currentTransactionRequest.network,
                currentTransactionRequest
              )
            const estimatedRollupGwei =
              await this.chainService.estimateL1RollupGasPrice(network)

            this.store.dispatch(
              updateRollupEstimates({ estimatedRollupFee, estimatedRollupGwei })
            )
          }
        }
        this.store.dispatch(
          estimatedFeesPerGas({ estimatedFeesPerGas: blockPrices, network })
        )
      }
    )

    // Report on transactions for basic activity. Fancier stuff is handled via
    // connectEnrichmentService
    this.chainService.emitter.on("transaction", async (transactionInfo) => {
      this.store.dispatch(addActivity(transactionInfo))
    })

    uiSliceEmitter.on("userActivityEncountered", (addressOnNetwork) => {
      this.abilitiesService.refreshAbilities()
      this.chainService.markAccountActivity(addressOnNetwork)
    })
  }

  async connectNameService(): Promise<void> {
    this.nameService.emitter.on(
      "resolvedName",
      async ({
        from: { addressOnNetwork },
        resolved: {
          nameOnNetwork: { name },
        },
      }) => {
        this.store.dispatch(updateAccountName({ ...addressOnNetwork, name }))
      }
    )
    this.nameService.emitter.on(
      "resolvedAvatar",
      async ({ from: { addressOnNetwork }, resolved: { avatar } }) => {
        this.store.dispatch(
          updateENSAvatar({ ...addressOnNetwork, avatar: avatar.toString() })
        )
      }
    )
  }

  async connectIndexingService(): Promise<void> {
    this.indexingService.emitter.on(
      "accountsWithBalances",
      async ({ balances, addressOnNetwork }) => {
        const assetsToTrack = await this.indexingService.getAssetsToTrack()
        const trackedAccounts = await this.chainService.getAccountsToTrack()
        const allTrackedAddresses = new Set(
          trackedAccounts.map((account) => account.address)
        )

        if (!allTrackedAddresses.has(addressOnNetwork.address)) {
          return
        }

        const filteredBalancesToDispatch: AccountBalance[] = []

        balances
          .filter((balance) => {
            // Network base assets with smart contract addresses from some networks
            // e.g. Optimism, Polygon might have been retrieved through alchemy as
            // token balances but they should not be handled here as they would
            // not be correctly treated as base assets
            return !isBuiltInNetworkBaseAsset(
              balance.assetAmount.asset,
              balance.network
            )
          })
          .forEach((balance) => {
            // TODO support multi-network assets
            const balanceHasAnAlreadyTrackedAsset = assetsToTrack.some(
              (tracked) => isSameAsset(tracked, balance.assetAmount.asset)
            )

            if (
              balance.assetAmount.amount > 0 ||
              balanceHasAnAlreadyTrackedAsset
            ) {
              filteredBalancesToDispatch.push(balance)
            }
          })

        this.store.dispatch(
          updateAccountBalance({
            balances: filteredBalancesToDispatch,
            addressOnNetwork,
          })
        )
      }
    )

    this.indexingService.emitter.on("assets", async (assets) => {
      await this.store.dispatch(assetsLoaded(assets))
    })

    this.indexingService.emitter.on("prices", (pricePoints) => {
      this.store.dispatch(newPricePoints(pricePoints))
    })

    this.indexingService.emitter.on("refreshAsset", (asset) => {
      this.store.dispatch(
        refreshAsset({
          asset,
        })
      )
    })

    this.indexingService.emitter.on("removeAssetData", (asset) => {
      this.store.dispatch(removeAssetData({ asset }))
    })
  }

  async connectEnrichmentService(): Promise<void> {
    this.enrichmentService.emitter.on(
      "enrichedEVMTransaction",
      (transactionData) => {
        this.indexingService.notifyEnrichedTransaction(
          transactionData.transaction
        )
        this.store.dispatch(addActivity(transactionData))
      }
    )
  }

  async connectSigningService(): Promise<void> {
    this.keyringService.emitter.on("address", (address) =>
      this.signingService.addTrackedAddress(address, "keyring")
    )

    this.ledgerService.emitter.on("address", ({ address }) =>
      this.signingService.addTrackedAddress(address, "ledger")
    )
  }

  async connectLedgerService(): Promise<void> {
    this.store.dispatch(resetLedgerState())

    this.ledgerService.emitter.on("connected", ({ id, metadata }) => {
      this.store.dispatch(
        setDeviceConnectionStatus({
          deviceID: id,
          status: "available",
          isArbitraryDataSigningEnabled: metadata.isArbitraryDataSigningEnabled,
          displayDetails: metadata.displayDetails,
        })
      )
    })

    this.ledgerService.emitter.on("disconnected", ({ id }) => {
      this.store.dispatch(
        setDeviceConnectionStatus({
          deviceID: id,
          status: "disconnected",
          isArbitraryDataSigningEnabled: false /* dummy */,
          displayDetails: undefined,
        })
      )
    })

    this.ledgerService.emitter.on("usbDeviceCount", (usbDeviceCount) => {
      this.store.dispatch(setUsbDeviceCount({ usbDeviceCount }))
    })
  }

  async connectKeyringService(): Promise<void> {
    this.keyringService.emitter.on("keyrings", (keyrings) => {
      this.store.dispatch(updateKeyrings(keyrings))
    })

    this.keyringService.emitter.on("address", async (address) => {
      const trackedNetworks = await this.chainService.getTrackedNetworks()
      trackedNetworks.forEach((network) => {
        // Mark as loading and wire things up.
        this.store.dispatch(
          loadAccount({
            address,
            network,
          })
        )

        this.chainService.addAccountToTrack({
          address,
          network,
        })
        this.abilitiesService.getNewAccountAbilities(address)
      })
    })

    this.keyringService.emitter.on("locked", async (isLocked) => {
      if (isLocked) {
        this.store.dispatch(keyringLocked())
      } else {
        this.store.dispatch(keyringUnlocked())
      }
    })

    keyringSliceEmitter.on("createPassword", async (password) => {
      await this.keyringService.unlock(password, true)
    })

    keyringSliceEmitter.on("lockKeyrings", async () => {
      await this.keyringService.lock()
    })

    keyringSliceEmitter.on("deriveAddress", async (keyringID) => {
      await this.signingService.deriveAddress({
        type: "keyring",
        keyringID,
      })
    })

    keyringSliceEmitter.on("generateNewKeyring", async (path) => {
      // TODO move unlocking to a reasonable place in the initialization flow
      const generated: {
        id: string
        mnemonic: string[]
      } = await this.keyringService.generateNewKeyring(
        KeyringTypes.mnemonicBIP39S256,
        path
      )

      this.store.dispatch(setKeyringToVerify(generated))
    })

    keyringSliceEmitter.on(
      "importKeyring",
      async ({ mnemonic, path, source }) => {
        await this.keyringService.importKeyring(mnemonic, source, path)
      }
    )
  }

  async connectInternalEthereumProviderService(): Promise<void> {
    this.internalEthereumProviderService.emitter.on(
      "transactionSignatureRequest",
      async ({ payload, resolver, rejecter }) => {
        await this.signingService.prepareForSigningRequest()

        this.store.dispatch(
          clearTransactionState(TransactionConstructionStatus.Pending)
        )
        this.store.dispatch(updateTransactionData(payload))

        const clear = () => {
          // Mutual dependency to handleAndClear.
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          this.signingService.emitter.off("signingTxResponse", handleAndClear)

          transactionConstructionSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: TXSignatureResponse) => {
          clear()
          switch (response.type) {
            case "success-tx":
              resolver(response.signedTx)
              break
            default:
              rejecter()
              break
          }
        }

        const rejectAndClear = () => {
          clear()
          rejecter()
        }

        this.signingService.emitter.on("signingTxResponse", handleAndClear)

        transactionConstructionSliceEmitter.on(
          "signatureRejected",
          rejectAndClear
        )
      }
    )
    this.internalEthereumProviderService.emitter.on(
      "signTypedDataRequest",
      async ({
        payload,
        resolver,
        rejecter,
      }: {
        payload: SignTypedDataRequest
        resolver: (result: string | PromiseLike<string>) => void
        rejecter: () => void
      }) => {
        // Run signer preparation and enrichment in parallel.
        const [, enrichedSignTypedDataRequest] = await Promise.all([
          this.signingService.prepareForSigningRequest(),
          this.enrichmentService.enrichSignTypedDataRequest(payload),
        ])

        this.store.dispatch(typedDataRequest(enrichedSignTypedDataRequest))

        const clear = () => {
          this.signingService.emitter.off(
            "signingDataResponse",
            // Mutual dependency to handleAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            handleAndClear
          )

          signingSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: SignatureResponse) => {
          clear()
          switch (response.type) {
            case "success-data":
              resolver(response.signedData)
              break
            default:
              rejecter()
              break
          }
        }

        const rejectAndClear = () => {
          clear()
          rejecter()
        }

        this.signingService.emitter.on("signingDataResponse", handleAndClear)

        signingSliceEmitter.on("signatureRejected", rejectAndClear)
      }
    )
    this.internalEthereumProviderService.emitter.on(
      "signDataRequest",
      async ({
        payload,
        resolver,
        rejecter,
      }: {
        payload: MessageSigningRequest
        resolver: (result: string | PromiseLike<string>) => void
        rejecter: () => void
      }) => {
        await this.signingService.prepareForSigningRequest()

        this.chainService.pollBlockPricesForNetwork(
          payload.account.network.chainID
        )
        this.store.dispatch(signDataRequest(payload))

        const clear = () => {
          this.signingService.emitter.off(
            "personalSigningResponse",
            // Mutual dependency to handleAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            handleAndClear
          )

          signingSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: SignatureResponse) => {
          clear()
          switch (response.type) {
            case "success-data":
              resolver(response.signedData)
              break
            default:
              rejecter()
              break
          }
        }

        const rejectAndClear = () => {
          clear()
          rejecter()
        }

        this.signingService.emitter.on(
          "personalSigningResponse",
          handleAndClear
        )

        signingSliceEmitter.on("signatureRejected", rejectAndClear)
      }
    )
    this.internalEthereumProviderService.emitter.on(
      "selectedNetwork",
      (network) => {
        this.store.dispatch(setSelectedNetwork(network))
      }
    )

    uiSliceEmitter.on("newSelectedNetwork", (network) => {
      this.internalEthereumProviderService.routeSafeRPCRequest(
        "wallet_switchEthereumChain",
        [{ chainId: network.chainID }],
        TALLY_INTERNAL_ORIGIN
      )
      this.chainService.pollBlockPricesForNetwork(network.chainID)
      this.store.dispatch(clearCustomGas())
    })

    this.internalEthereumProviderService.emitter.on(
      "watchAssetRequest",
      async ({ contractAddress, network }) => {
        const { address } = this.store.getState().ui.selectedAccount
        const asset = await this.indexingService.addTokenToTrackByContract(
          network,
          contractAddress
        )
        if (asset) {
          await this.indexingService.retrieveTokenBalances(
            {
              address,
              network,
            },
            [asset]
          )
        }
      }
    )
  }

  async connectProviderBridgeService(): Promise<void> {
    uiSliceEmitter.on("addCustomNetworkResponse", ([requestId, success]) => {
      return this.providerBridgeService.handleAddNetworkRequest(
        requestId,
        success
      )
    })

    this.providerBridgeService.emitter.on(
      "requestPermission",
      (permissionRequest: PermissionRequest) => {
        this.store.dispatch(requestPermission(permissionRequest))
      }
    )

    this.providerBridgeService.emitter.on(
      "initializeAllowedPages",
      async (allowedPages: PermissionMap) => {
        this.store.dispatch(initializePermissions(allowedPages))
      }
    )

    this.providerBridgeService.emitter.on(
      "setClaimReferrer",
      async (referral: string) => {
        const isAddress = isProbablyEVMAddress(referral)
        const network = getEthereumNetwork()
        const ensName = isAddress
          ? (
              await this.nameService.lookUpName({
                address: referral,
                network,
              })
            )?.resolved?.nameOnNetwork?.name
          : referral
        const address = isAddress
          ? referral
          : (
              await this.nameService.lookUpEthereumAddress({
                name: referral,
                network,
              })
            )?.resolved?.addressOnNetwork?.address

        if (typeof address !== "undefined") {
          this.store.dispatch(
            setReferrer({
              address,
              ensName,
            })
          )
        }
      }
    )

    providerBridgeSliceEmitter.on("grantPermission", async (permission) => {
      this.analyticsService.sendAnalyticsEvent(AnalyticsEvent.DAPP_CONNECTED, {
        origin: permission.origin,
        chainId: permission.chainID,
      })
      await Promise.all(
        this.chainService.supportedNetworks.map(async (network) => {
          await this.providerBridgeService.grantPermission({
            ...permission,
            chainID: network.chainID,
          })
        })
      )
    })

    providerBridgeSliceEmitter.on(
      "denyOrRevokePermission",
      async (permission) => {
        await Promise.all(
          this.chainService.supportedNetworks.map(async (network) => {
            await this.providerBridgeService.denyOrRevokePermission({
              ...permission,
              chainID: network.chainID,
            })
          })
        )
      }
    )
  }

  async connectPreferenceService(): Promise<void> {
    this.preferenceService.emitter.on(
      "initializeDefaultWallet",
      async (isDefaultWallet: boolean) => {
        await this.store.dispatch(setDefaultWallet(isDefaultWallet))
      }
    )

    this.preferenceService.emitter.on(
      "initializeSelectedAccount",
      async (dbAddressNetwork: AddressOnNetwork) => {
        if (dbAddressNetwork) {
          // TBD: naming the normal reducer and async thunks
          // Initialize redux from the db
          // !!! Important: this action belongs to a regular reducer.
          // NOT to be confused with the setNewCurrentAddress asyncThunk
          this.store.dispatch(setSelectedAccount(dbAddressNetwork))
        } else {
          // Update currentAddress in db if it's not set but it is in the store
          // should run only one time
          const addressNetwork = this.store.getState().ui.selectedAccount

          if (addressNetwork) {
            await this.preferenceService.setSelectedAccount(addressNetwork)
          }
        }
      }
    )

    this.preferenceService.emitter.on(
      "updatedSignerSettings",
      (accountSignerSettings) => {
        this.store.dispatch(setAccountsSignerSettings(accountSignerSettings))
      }
    )

    this.preferenceService.emitter.on(
      "initializeShownDismissableItems",
      async (dismissableItems) => {
        this.store.dispatch(setShownDismissableItems(dismissableItems))
      }
    )

    this.preferenceService.emitter.on(
      "dismissableItemMarkedAsShown",
      async (dismissableItem) => {
        this.store.dispatch(dismissableItemMarkedAsShown(dismissableItem))
      }
    )

    uiSliceEmitter.on("newSelectedAccount", async (addressNetwork) => {
      await this.preferenceService.setSelectedAccount(addressNetwork)

      this.store.dispatch(clearSwapQuote())
      this.store.dispatch(setEligibilityLoading())
      this.doggoService.getEligibility(addressNetwork.address)

      this.store.dispatch(setVaultsAsStale())

      await this.chainService.markAccountActivity(addressNetwork)

      const referrerStats = await this.doggoService.getReferrerStats(
        addressNetwork
      )
      this.store.dispatch(setReferrerStats(referrerStats))

      this.providerBridgeService.notifyContentScriptsAboutAddressChange(
        addressNetwork.address
      )
    })

    uiSliceEmitter.on("newSelectedAccountSwitched", async (addressNetwork) => {
      this.enrichActivities(addressNetwork)
    })

    uiSliceEmitter.on(
      "newDefaultWalletValue",
      async (newDefaultWalletValue) => {
        await this.preferenceService.setDefaultWalletValue(
          newDefaultWalletValue
        )

        // FIXME Both of these should be done as observations of the preference
        // FIXME service event rather than being managed by `main`.
        this.providerBridgeService.notifyContentScriptAboutConfigChange(
          newDefaultWalletValue
        )
        this.analyticsService.sendAnalyticsEvent(
          AnalyticsEvent.DEFAULT_WALLET_TOGGLED,
          {
            setToDefault: newDefaultWalletValue,
          }
        )
      }
    )

    uiSliceEmitter.on("refreshBackgroundPage", async () => {
      window.location.reload()
    })
  }

  async connectDoggoService(): Promise<void> {
    this.doggoService.emitter.on(
      "newEligibility",
      async (eligibility: Eligible) => {
        await this.store.dispatch(setEligibility(eligibility))
      }
    )

    this.doggoService.emitter.on(
      "newReferral",
      async (
        referral: {
          referrer: AddressOnNetwork
        } & ReferrerStats
      ) => {
        const { referrer, referredUsers, bonusTotal } = referral
        const { selectedAccount } = this.store.getState().ui

        if (
          normalizeEVMAddress(referrer.address) ===
          normalizeEVMAddress(selectedAccount.address)
        ) {
          this.store.dispatch(
            setReferrerStats({
              referredUsers,
              bonusTotal,
            })
          )
        }
      }
    )
  }

  connectTelemetryService(): void {
    // Pass the redux store to the telemetry service so we can analyze its size
    this.telemetryService.connectReduxStore(this.store)
  }

  connectNFTsService(): void {
    this.nftsService.emitter.on(
      "initializeNFTs",
      (collections: NFTCollection[]) => {
        this.store.dispatch(initializeNFTs(collections))
      }
    )
    this.nftsService.emitter.on(
      "updateCollections",
      (collections: NFTCollection[]) => {
        this.store.dispatch(updateNFTsCollections(collections))
      }
    )
    this.nftsService.emitter.on("updateNFTs", async (payload) => {
      await this.store.dispatch(updateNFTs(payload))
    })
    this.nftsService.emitter.on("removeTransferredNFTs", async (payload) => {
      this.store.dispatch(deleteTransferredNFTs(payload))
    })
    this.nftsService.emitter.on("isReloadingNFTs", async (payload) => {
      this.store.dispatch(updateIsReloading(payload))
    })
    nftsSliceEmitter.on("fetchNFTs", ({ collectionID, account }) =>
      this.nftsService.fetchNFTsFromCollection(collectionID, account)
    )
    nftsSliceEmitter.on("refetchNFTs", ({ collectionID, account }) =>
      this.nftsService.refreshNFTsFromCollection(collectionID, account)
    )
    nftsSliceEmitter.on("fetchMoreNFTs", ({ collectionID, account }) =>
      this.nftsService.fetchNFTsFromNextPage(collectionID, account)
    )
    nftsSliceEmitter.on("refetchCollections", () =>
      this.nftsService.refreshCollections()
    )
  }

  // eslint-disable-next-line class-methods-use-this
  connectWalletConnectService(): void {
    // TODO: here comes the glue between the UI and service layer
  }

  connectAbilitiesService(): void {
    this.abilitiesService.emitter.on("initAbilities", (address) => {
      this.store.dispatch(initAbilities(address))
    })
    this.abilitiesService.emitter.on(
      "updatedAbilities",
      ({ address, abilities }) => {
        this.store.dispatch(setAbilitiesForAddress({ address, abilities }))
      }
    )
    this.abilitiesService.emitter.on("deleteAbilities", (address) => {
      this.store.dispatch(deleteAbilitiesForAccount(address))
    })
    this.abilitiesService.emitter.on("updatedAbility", (ability) => {
      this.store.dispatch(updateAbility(ability))
    })
    this.abilitiesService.emitter.on("newAccount", (address) => {
      this.store.dispatch(addAccountFilter(address))
    })
    this.abilitiesService.emitter.on("deleteAccount", (address) => {
      this.store.dispatch(deleteAccountFilter(address))
    })
  }

  async unlockKeyrings(password: string): Promise<boolean> {
    return this.keyringService.unlock(password)
  }

  async getActivityDetails(txHash: string): Promise<ActivityDetail[]> {
    const addressNetwork = this.store.getState().ui.selectedAccount
    const transaction = await this.chainService.getTransaction(
      addressNetwork.network,
      txHash
    )
    const enrichedTransaction = await this.enrichmentService.enrichTransaction(
      transaction,
      2
    )

    return getActivityDetails(enrichedTransaction)
  }

  async connectAnalyticsService(): Promise<void> {
    this.analyticsService.emitter.on("enableDefaultOn", () => {
      this.store.dispatch(setShowAnalyticsNotification(true))
    })

    this.chainService.emitter.on("networkSubscribed", (network) => {
      this.analyticsService.sendOneTimeAnalyticsEvent(
        OneTimeAnalyticsEvent.CHAIN_ADDED,
        {
          chainId: network.chainID,
          name: network.name,
          description: `This event is fired when a chain is subscribed to from the wallet for the first time.`,
        }
      )
    })

    // ⚠️ Note: We NEVER send addresses to analytics!
    this.chainService.emitter.on("newAccountToTrack", () => {
      this.analyticsService.sendAnalyticsEvent(
        AnalyticsEvent.NEW_ACCOUNT_TO_TRACK,
        {
          description: `
                This event is fired when any address on a network is added to the tracked list. 
                
                Note: this does not track recovery phrase(ish) import! But when an address is used 
                on a network for the first time (read-only or recovery phrase/ledger/keyring).
                `,
        }
      )
    })

    this.chainService.emitter.on("customChainAdded", (chainInfo) => {
      this.analyticsService.sendAnalyticsEvent(
        AnalyticsEvent.CUSTOM_CHAIN_ADDED,
        {
          description: `
                This event is fired when a custom chain is added to the wallet.
                `,
          chainInfo: chainInfo.chainName,
          chainId: chainInfo.chainId,
        }
      )
    })

    this.preferenceService.emitter.on(
      "updateAnalyticsPreferences",
      async (analyticsPreferences: AnalyticsPreferences) => {
        // This event is used on initialization and data change
        this.store.dispatch(
          toggleCollectAnalytics(
            // we are using only this field on the UI atm
            // it's expected that more detailed analytics settings will come
            analyticsPreferences.isEnabled
          )
        )

        this.analyticsService.sendAnalyticsEvent(
          AnalyticsEvent.ANALYTICS_TOGGLED,
          {
            analyticsEnabled: analyticsPreferences.isEnabled,
          }
        )
      }
    )

    uiSliceEmitter.on(
      "updateAnalyticsPreferences",
      async (analyticsPreferences: Partial<AnalyticsPreferences>) => {
        await this.preferenceService.updateAnalyticsPreferences(
          analyticsPreferences
        )
      }
    )

    uiSliceEmitter.on("deleteAnalyticsData", () => {
      this.analyticsService.removeAnalyticsData()
    })

    uiSliceEmitter.on("sendEvent", (event) => {
      if (isOneTimeAnalyticsEvent(event)) {
        this.analyticsService.sendOneTimeAnalyticsEvent(event)
      } else {
        this.analyticsService.sendAnalyticsEvent(event)
      }
    })
  }

  async updateAssetMetadata(
    asset: SmartContractFungibleAsset,
    metadata: AnyAssetMetadata
  ): Promise<void> {
    await this.indexingService.updateAssetMetadata(asset, metadata)
  }

  async hideAsset(asset: SmartContractFungibleAsset): Promise<void> {
    await this.indexingService.hideAsset(asset)
  }

  getAddNetworkRequestDetails(requestId: string): AddChainRequestData {
    return this.providerBridgeService.getNewCustomRPCDetails(requestId)
  }

  async updateSignerTitle(
    signer: AccountSignerWithId,
    title: string
  ): Promise<void> {
    return this.preferenceService.updateAccountSignerTitle(signer, title)
  }

  async markDismissableItemAsShown(item: DismissableItem): Promise<void> {
    return this.preferenceService.markDismissableItemAsShown(item)
  }

  async resolveNameOnNetwork(
    nameOnNetwork: NameOnNetwork
  ): Promise<AddressOnNetwork | undefined> {
    try {
      return (await this.nameService.lookUpEthereumAddress(nameOnNetwork))
        ?.resolved?.addressOnNetwork
    } catch (error) {
      logger.info("Error looking up Ethereum address: ", error)
      return undefined
    }
  }

  async pollForAbilities(address: NormalizedEVMAddress): Promise<void> {
    return this.abilitiesService.pollForAbilities(address)
  }

  async markAbilityAsCompleted(
    address: NormalizedEVMAddress,
    abilityId: string
  ): Promise<void> {
    return this.abilitiesService.markAbilityAsCompleted(address, abilityId)
  }

  async markAbilityAsRemoved(
    address: NormalizedEVMAddress,
    abilityId: string
  ): Promise<void> {
    return this.abilitiesService.markAbilityAsRemoved(address, abilityId)
  }

  async reportAndRemoveAbility(
    address: NormalizedEVMAddress,
    abilitySlug: string,
    abilityId: string,
    reason: string
  ): Promise<void> {
    this.abilitiesService.reportAndRemoveAbility(
      address,
      abilitySlug,
      abilityId,
      reason
    )
  }

  async addCustomNetwork(
    networkParams: ValidatedAddEthereumChainParameter
  ): Promise<EVMNetwork> {
    const customNetwork = await this.chainService.addCustomChain(networkParams)

    this.store.dispatch(setSelectedNetwork(customNetwork))

    return customNetwork
  }

  async removeEVMNetwork(chainID: string): Promise<void> {
    // Per origin chain id settings
    await this.internalEthereumProviderService.removePrefererencesForChain(
      chainID
    )
    // Connected dApps
    await this.providerBridgeService.revokePermissionsForChain(chainID)
    await this.chainService.removeCustomChain(chainID)
  }

  async queryCustomTokenDetails(
    contractAddress: NormalizedEVMAddress,
    addressOnNetwork: AddressOnNetwork
  ): Promise<{
    asset: SmartContractFungibleAsset
    amount: bigint
    mainCurrencyAmount?: number
    balance: number
    exists?: boolean
  }> {
    const { network } = addressOnNetwork

    const cachedAsset = this.indexingService
      .getCachedAssets(network)
      .find(
        (asset): asset is SmartContractFungibleAsset =>
          isSmartContractFungibleAsset(asset) &&
          sameEVMAddress(contractAddress, asset.contractAddress)
      )

    const assetData = await this.chainService.queryAccountTokenDetails(
      contractAddress,
      addressOnNetwork,
      cachedAsset
    )

    const priceData = await getTokenPrices([contractAddress], USD, network)

    const convertedAssetAmount =
      contractAddress in priceData
        ? convertAssetAmountViaPricePoint(
            assetData,
            getPricePoint(assetData.asset, priceData[contractAddress])
          )
        : undefined

    const mainCurrencyAmount = convertedAssetAmount
      ? assetAmountToDesiredDecimals(convertedAssetAmount, 2)
      : undefined

    return {
      ...assetData,
      balance: Number.parseFloat(
        utils.formatUnits(assetData.amount, assetData.asset.decimals)
      ),
      mainCurrencyAmount,
      exists: !!cachedAsset,
    }
  }

  async importCustomToken(asset: SmartContractFungibleAsset): Promise<boolean> {
    return this.indexingService.importCustomToken(asset)
  }

  private connectPopupMonitor() {
    runtime.onConnect.addListener((port) => {
      if (port.name !== popupMonitorPortName) return

      const openTime = Date.now()

      const originalNetworkName =
        this.store.getState().ui.selectedAccount.network.name

      port.onDisconnect.addListener(() => {
        const networkNameAtClose =
          this.store.getState().ui.selectedAccount.network.name
        this.analyticsService.sendAnalyticsEvent(AnalyticsEvent.UI_SHOWN, {
          openTime: new Date(openTime).toISOString(),
          closeTime: new Date().toISOString(),
          openLength: (Date.now() - openTime) / 1e3,
          networkName:
            originalNetworkName === networkNameAtClose
              ? originalNetworkName
              : "switched networks",
          unit: "s",
        })
        this.onPopupDisconnected()
      })
    })
  }

  private onPopupDisconnected() {
    this.store.dispatch(rejectTransactionSignature())
    this.store.dispatch(rejectDataSignature())
  }
}
