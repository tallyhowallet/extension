import { createSlice } from "@reduxjs/toolkit"
import { createBackgroundAsyncThunk } from "./utils"
import { AccountBalance, AddressOnNetwork, NameOnNetwork } from "../accounts"
import { EVMNetwork, Network } from "../networks"
import {
  AnyAsset,
  AnyAssetAmount,
  isFungibleAsset,
  isSmartContractFungibleAsset,
  SmartContractFungibleAsset,
} from "../assets"
import {
  AssetMainCurrencyAmount,
  AssetDecimalAmount,
  isBuiltInNetworkBaseAsset,
} from "./utils/asset-utils"
import { DomainName, HexString, URI } from "../types"
import { normalizeEVMAddress, sameEVMAddress } from "../lib/utils"
import { AccountSigner } from "../services/signing"
import { NETWORK_BY_CHAIN_ID, TEST_NETWORK_BY_CHAIN_ID } from "../constants"
import { convertFixedPoint } from "../lib/fixed-point"

/**
 * The set of available UI account types. These may or may not map 1-to-1 to
 * internal account types, depending on how the UI chooses to display data.
 */
export const enum AccountType {
  ReadOnly = "read-only",
  Imported = "imported",
  Ledger = "ledger",
  Internal = "internal",
}

export const DEFAULT_ACCOUNT_NAMES = [
  "Phoenix",
  "Matilda",
  "Sirius",
  "Topa",
  "Atos",
  "Sport",
  "Lola",
  "Foz",
]

const availableDefaultNames = [...DEFAULT_ACCOUNT_NAMES]

export type AccountData = {
  address: HexString
  network: Network
  balances: {
    [assetSymbol: string]: AccountBalance
  }
  ens: {
    name?: DomainName
    avatarURL?: URI
  }
  defaultName: string
  defaultAvatar: string
}

type AccountsByChainID = {
  [chainID: string]: {
    [address: string]: AccountData | "loading"
  }
}

export type AccountState = {
  account?: AddressOnNetwork
  accountLoading?: string
  hasAccountError?: boolean
  accountsData: {
    evm: AccountsByChainID
  }
  combinedData: CombinedAccountData
}

export type CombinedAccountData = {
  totalMainCurrencyValue?: string
  assets: AnyAssetAmount[]
}

// Utility type, wrapped in CompleteAssetAmount<T>.
type InternalCompleteAssetAmount<
  E extends AnyAsset = AnyAsset,
  T extends AnyAssetAmount<E> = AnyAssetAmount<E>
> = T & AssetMainCurrencyAmount & AssetDecimalAmount

/**
 * An asset amount including localized and numeric main currency and decimal
 * equivalents, where applicable.
 */
export type CompleteAssetAmount<T extends AnyAsset = AnyAsset> =
  InternalCompleteAssetAmount<T, AnyAssetAmount<T>>

export type CompleteSmartContractFungibleAssetAmount =
  CompleteAssetAmount<SmartContractFungibleAsset>

export const initialState: AccountState = {
  accountsData: { evm: {} },
  combinedData: {
    totalMainCurrencyValue: "",
    assets: [],
  },
}

function newAccountData(
  address: HexString,
  network: EVMNetwork,
  accountsState: AccountState
): AccountData {
  const existingAccountsCount = Object.keys(
    accountsState.accountsData.evm[network.chainID]
  ).filter((key) => key !== address).length

  const sameAccountOnDifferentChain = Object.values(
    accountsState.accountsData.evm
  )
    .flatMap((chain) => Object.values(chain))
    .find(
      (accountData): accountData is AccountData =>
        accountData !== "loading" && accountData.address === address
    )
  const defaultNameIndex =
    // Skip potentially-used names at the beginning of the array if relevant,
    // see below.
    (existingAccountsCount % availableDefaultNames.length) +
    Number(
      // Treat the address as a number and mod it to get an index into
      // default names.
      BigInt(address) %
        BigInt(
          availableDefaultNames.length -
            (existingAccountsCount % availableDefaultNames.length)
        )
    )

  let defaultAccountName = sameAccountOnDifferentChain?.defaultName

  if (typeof defaultAccountName === "undefined") {
    defaultAccountName = availableDefaultNames[defaultNameIndex]
    // Move used default names to the start so they can be skipped above.
    availableDefaultNames.splice(defaultNameIndex, 1)
    availableDefaultNames.unshift(defaultAccountName)
  }

  const defaultAccountAvatar = `./images/avatars/${defaultAccountName.toLowerCase()}@2x.png`

  return {
    address,
    network,
    balances: {},
    ens: {},
    defaultName: defaultAccountName,
    defaultAvatar: defaultAccountAvatar,
  }
}

function updateCombinedData(immerState: AccountState) {
  // A key assumption here is that the balances of two accounts in
  // accountsData are mutually exclusive; that is, that there are no two
  // accounts in accountsData all or part of whose balances are shared with
  // each other.
  const filteredEvm = Object.keys(immerState.accountsData.evm)
    .filter((key) => !TEST_NETWORK_BY_CHAIN_ID.has(key))
    .reduce<AccountsByChainID>((evm, key) => {
      return {
        ...evm,
        [key]: immerState.accountsData.evm[key],
      }
    }, {})

  const combinedAccountBalances = Object.values(filteredEvm)
    .flatMap((accountDataByChain) => Object.values(accountDataByChain))
    .flatMap((ad) =>
      ad === "loading"
        ? []
        : Object.values(ad.balances).map((ab) => ab.assetAmount)
    )

  immerState.combinedData.assets = Object.values(
    combinedAccountBalances.reduce<{
      [symbol: string]: AnyAssetAmount
    }>((acc, combinedAssetAmount) => {
      const assetSymbol = combinedAssetAmount.asset.symbol
      let { amount } = combinedAssetAmount

      if (acc[assetSymbol]?.asset) {
        const accAsset = acc[assetSymbol].asset
        const existingDecimals = isFungibleAsset(accAsset)
          ? accAsset.decimals
          : 0
        const newDecimals = isFungibleAsset(combinedAssetAmount.asset)
          ? combinedAssetAmount.asset.decimals
          : 0

        if (newDecimals !== existingDecimals) {
          amount = convertFixedPoint(amount, newDecimals, existingDecimals)
        }
      }

      if (acc[assetSymbol]) {
        acc[assetSymbol].amount += amount
      } else {
        acc[assetSymbol] = {
          ...combinedAssetAmount,
        }
      }
      return acc
    }, {})
  )
}

function getOrCreateAccountData(
  accountState: AccountState,
  account: HexString,
  network: EVMNetwork
): AccountData {
  const accountData = accountState.accountsData.evm[network.chainID][account]

  if (accountData === "loading" || !accountData) {
    return newAccountData(account, network, accountState)
  }
  return accountData
}

// TODO Much of the combinedData bits should probably be done in a Reselect
// TODO selector.
const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    loadAccount: (
      immerState,
      { payload: { address, network } }: { payload: AddressOnNetwork }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)
      if (
        immerState.accountsData.evm[network.chainID]?.[normalizedAddress] !==
        undefined
      ) {
        // If the account data already exists, the account is already loaded.
        return
      }

      immerState.accountsData.evm[network.chainID] ??= {}

      immerState.accountsData.evm[network.chainID] = {
        ...immerState.accountsData.evm[network.chainID],
        [normalizedAddress]: "loading",
      }
    },
    deleteAccount: (
      immerState,
      { payload: address }: { payload: HexString }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      const { evm } = immerState.accountsData

      if (
        // One of the chains
        !Object.keys(evm ?? {}).some((chainID) =>
          // has an address equal to the one we're trying to remove
          Object.keys(evm[chainID]).some(
            (addressOnChain) => addressOnChain === normalizedAddress
          )
        )
      ) {
        // If none of the chains we're tracking has a matching address - this is a noop.
        return
      }

      // Delete the account from all chains.
      Object.keys(evm).forEach((chainId) => {
        const { [normalizedAddress]: _, ...withoutEntryToRemove } = evm[chainId]

        immerState.accountsData.evm[chainId] = withoutEntryToRemove
      })

      updateCombinedData(immerState)
    },
    updateAccountBalance: (
      immerState,
      {
        payload: { balances },
      }: {
        payload: {
          balances: AccountBalance[]
          addressOnNetwork: AddressOnNetwork
        }
      }
    ) => {
      balances.forEach((updatedAccountBalance) => {
        const {
          address,
          network,
          assetAmount: { asset },
        } = updatedAccountBalance
        const { symbol: updatedAssetSymbol } = asset

        const normalizedAddress = normalizeEVMAddress(address)
        const existingAccountData =
          immerState.accountsData.evm[network.chainID]?.[normalizedAddress]

        // Don't upsert, only update existing account entries.
        if (existingAccountData === undefined) {
          return
        }

        if (existingAccountData !== "loading") {
          if (
            updatedAccountBalance.assetAmount.amount === 0n &&
            existingAccountData.balances[updatedAssetSymbol] === undefined &&
            !isBuiltInNetworkBaseAsset(asset, network) // add base asset even if balance is 0
          ) {
            return
          }
          existingAccountData.balances[updatedAssetSymbol] =
            updatedAccountBalance
        } else {
          immerState.accountsData.evm[network.chainID][normalizedAddress] = {
            // TODO Figure out the best way to handle default name assignment
            // TODO across networks.
            ...newAccountData(address, network, immerState),
            balances: {
              [updatedAssetSymbol]: updatedAccountBalance,
            },
          }
        }
      })

      updateCombinedData(immerState)
    },
    updateAccountName: (
      immerState,
      {
        payload: { address, network, name },
      }: { payload: AddressOnNetwork & { name: DomainName } }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      // No entry means this name doesn't correspond to an account we are
      // tracking.
      if (
        immerState.accountsData.evm[network.chainID]?.[normalizedAddress] ===
        undefined
      ) {
        return
      }

      immerState.accountsData.evm[network.chainID] ??= {}

      const baseAccountData = getOrCreateAccountData(
        immerState,
        normalizedAddress,
        network
      )

      immerState.accountsData.evm[network.chainID][normalizedAddress] = {
        ...baseAccountData,
        ens: { ...baseAccountData.ens, name },
      }
    },
    updateAccountLocalName: (
      immerState,
      {
        payload: { address, name },
      }: { payload: { address: string; name: DomainName } }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      Object.keys(immerState.accountsData.evm).forEach((chainID) => {
        if (
          immerState.accountsData.evm[chainID]?.[normalizedAddress] ===
          undefined
        ) {
          return
        }

        const network = NETWORK_BY_CHAIN_ID[chainID]
        const baseAccountData = getOrCreateAccountData(
          immerState,
          normalizedAddress,
          network
        )

        immerState.accountsData.evm[chainID][normalizedAddress] = {
          ...baseAccountData,
          ens: { ...baseAccountData.ens, name },
        }
      })
    },
    updateENSAvatar: (
      immerState,
      {
        payload: { address, network, avatar },
      }: { payload: AddressOnNetwork & { avatar: URI } }
    ) => {
      const normalizedAddress = normalizeEVMAddress(address)

      // No entry means this avatar doesn't correspond to an account we are
      // tracking.
      if (
        immerState.accountsData.evm[network.chainID]?.[normalizedAddress] ===
        undefined
      ) {
        return
      }

      immerState.accountsData.evm[network.chainID] ??= {}

      // TODO Figure out the best way to handle default name assignment
      // TODO across networks.
      const baseAccountData = getOrCreateAccountData(
        immerState,
        normalizedAddress,
        network
      )

      immerState.accountsData.evm[network.chainID][normalizedAddress] = {
        ...baseAccountData,
        ens: { ...baseAccountData.ens, avatarURL: avatar },
      }
    },
    /**
     * Updates cached SmartContracts metadata
     */
    updateAssetCache: (
      immerState,
      { payload: asset }: { payload: SmartContractFungibleAsset }
    ) => {
      const allAccounts = immerState.accountsData.evm[asset.homeNetwork.chainID]
      Object.keys(allAccounts).forEach((address) => {
        const account = allAccounts[address]
        if (account !== "loading") {
          Object.values(account.balances).forEach(({ assetAmount }) => {
            if (
              isSmartContractFungibleAsset(assetAmount.asset) &&
              sameEVMAddress(
                assetAmount.asset.contractAddress,
                asset.contractAddress
              )
            ) {
              Object.assign(assetAmount.asset, asset)
            }
          })
        }
      })

      updateCombinedData(immerState)
    },
  },
})

export const {
  deleteAccount,
  loadAccount,
  updateAccountBalance,
  updateAccountName,
  updateAccountLocalName,
  updateENSAvatar,
  updateAssetCache,
} = accountSlice.actions

export default accountSlice.reducer

/**
 * Async thunk whose dispatch promise will return a resolved name or undefined
 * if the name cannot be resolved.
 */
export const resolveNameOnNetwork = createBackgroundAsyncThunk(
  "account/resolveNameOnNetwork",
  async (nameOnNetwork: NameOnNetwork, { extra: { main } }) => {
    return main.resolveNameOnNetwork(nameOnNetwork)
  }
)

/**
 * Async thunk whose dispatch promise will return when the account has been
 * added.
 *
 * Actual account data will flow into the redux store through other channels;
 * the promise returned from this action's dispatch will be fulfilled by a void
 * value.
 */
export const addAddressNetwork = createBackgroundAsyncThunk(
  "account/addAccount",
  async (addressNetwork: AddressOnNetwork, { dispatch, extra: { main } }) => {
    const normalizedAddressNetwork = {
      address: normalizeEVMAddress(addressNetwork.address),
      network: addressNetwork.network,
    }

    dispatch(loadAccount(normalizedAddressNetwork))
    await main.addAccount(normalizedAddressNetwork)
  }
)

export const addOrEditAddressName = createBackgroundAsyncThunk(
  "account/addOrEditAddressName",
  async (payload: AddressOnNetwork & { name: string }, { extra: { main } }) => {
    await main.addOrEditAddressName(payload)
  }
)

export const removeAccount = createBackgroundAsyncThunk(
  "account/removeAccount",
  async (
    payload: {
      addressOnNetwork: AddressOnNetwork
      signer: AccountSigner
      lastAddressInAccount: boolean
    },
    { extra: { main } }
  ) => {
    const { addressOnNetwork, signer, lastAddressInAccount } = payload
    const normalizedAddress = normalizeEVMAddress(addressOnNetwork.address)

    await main.removeAccount(normalizedAddress, signer, lastAddressInAccount)
  }
)
