import { FiatCurrency } from "../../assets"
import { AddressOnNetwork, NameOnNetwork } from "../../accounts"
import { ServiceLifecycleEvents, ServiceCreatorFunction } from "../types"

import {
  AnalyticsPreferences,
  Preferences,
  TokenListPreferences,
} from "./types"
import { getOrCreateDB, PreferenceDatabase } from "./db"
import BaseService from "../base"
import { normalizeEVMAddress } from "../../lib/utils"
import { ETHEREUM, OPTIMISM, ARBITRUM_ONE } from "../../constants"
import { EVMNetwork, sameNetwork } from "../../networks"
import { HexString } from "../../types"
import { AccountSignerSettings } from "../../ui"
import { AccountSignerWithId } from "../../signing"

type ContractAddressBookEntry = {
  network: EVMNetwork
  address: HexString
  name: string
}

type CustomAddressBookEntry = {
  // no network to make custom names global
  address: HexString
  name: string
}

const BUILT_IN_CONTRACTS = [
  {
    network: ETHEREUM,
    address: normalizeEVMAddress("0xDef1C0ded9bec7F1a1670819833240f027b25EfF"),
    name: "0x Router",
  },
  {
    network: OPTIMISM,
    address: normalizeEVMAddress("0xdef1abe32c034e558cdd535791643c58a13acc10"),
    name: "0x Router",
  },
  {
    network: ETHEREUM,
    // Uniswap v3 Router
    address: normalizeEVMAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
    name: "🦄 Uniswap",
  },
  {
    network: OPTIMISM,
    // Uniswap v3 Router
    address: normalizeEVMAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
    name: "🦄 Uniswap",
  },
  {
    network: ARBITRUM_ONE,
    // Uniswap v3 Router
    address: normalizeEVMAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
    name: "🦄 Uniswap",
  },
  {
    network: ETHEREUM,
    // Optimism's custodial Teleportr bridge
    // https://etherscan.io/address/0x52ec2f3d7c5977a8e558c8d9c6000b615098e8fc
    address: normalizeEVMAddress("0x52ec2f3d7c5977a8e558c8d9c6000b615098e8fc"),
    name: "🔴 Optimism Teleportr",
  },
  {
    network: OPTIMISM,
    // https://optimistic.etherscan.io/address/0x4200000000000000000000000000000000000010
    address: normalizeEVMAddress("0x4200000000000000000000000000000000000010"),
    name: "🔴 Optimism Teleportr",
  },
  {
    network: ETHEREUM,
    // Optimism's non-custodial Gateway bridge
    address: normalizeEVMAddress("0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1"),
    name: "🔴 Optimism Gateway",
  },
  {
    network: ETHEREUM,
    // Arbitrum's Delayed Inbox
    // https://etherscan.io/address/0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f
    address: normalizeEVMAddress("0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f"),
    name: "🔵 Arbitrum bridge",
  },
  {
    network: ETHEREUM,
    // Arbitrum's old bridge contract
    // https://etherscan.io/address/0x011b6e24ffb0b5f5fcc564cf4183c5bbbc96d515
    address: normalizeEVMAddress("0x011B6E24FfB0B5f5fCc564cf4183C5BBBc96D515"),
    name: "🔵 Arbitrum Old Bridge",
  },
]

interface Events extends ServiceLifecycleEvents {
  preferencesChanges: Preferences
  initializeDefaultWallet: boolean
  initializeSelectedAccount: AddressOnNetwork
  addressBookEntryModified: AddressOnNetwork & { name: string }
  updateAnalyticsPreferences: AnalyticsPreferences
  updatedSignerSettings: AccountSignerSettings[]
}

/*
 * The preference service manages user preference persistence, emitting an
 * event when preferences change.
 */
export default class PreferenceService extends BaseService<Events> {
  private knownContracts: ContractAddressBookEntry[] = BUILT_IN_CONTRACTS

  private addressBook: CustomAddressBookEntry[] = []

  /*
   * Create a new PreferenceService. The service isn't initialized until
   * startService() is called and resolved.
   */
  static create: ServiceCreatorFunction<Events, PreferenceService, []> =
    async () => {
      const db = await getOrCreateDB()

      return new this(db)
    }

  private constructor(private db: PreferenceDatabase) {
    super()
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService()

    this.emitter.emit("initializeDefaultWallet", await this.getDefaultWallet())
    this.emitter.emit(
      "initializeSelectedAccount",
      await this.getSelectedAccount()
    )
    this.emitter.emit(
      "updateAnalyticsPreferences",
      await this.getAnalyticsPreferences()
    )
  }

  protected override async internalStopService(): Promise<void> {
    this.db.close()

    await super.internalStopService()
  }

  // TODO Implement the following 6 methods as something stored in the database and user-manageable.
  // TODO Track account names in the UI in the address book.

  addOrEditNameInAddressBook({
    address,
    network,
    name,
  }: {
    network: EVMNetwork
    address: HexString
    name: string
  }): void {
    const newEntry = {
      address: normalizeEVMAddress(address),
      name,
    }
    const correspondingEntryIndex = this.addressBook.findIndex(
      (entry) =>
        normalizeEVMAddress(newEntry.address) ===
        normalizeEVMAddress(entry.address)
    )
    if (correspondingEntryIndex !== -1) {
      this.addressBook[correspondingEntryIndex] = newEntry
    } else {
      this.addressBook.push(newEntry)
    }
    this.emitter.emit("addressBookEntryModified", { ...newEntry, network })
  }

  lookUpAddressForName({
    name,
    network,
  }: NameOnNetwork): AddressOnNetwork | undefined {
    const entry = this.addressBook.find(
      ({ name: entryName }) => name === entryName
    )
    return entry ? { address: entry.address, network } : undefined
  }

  lookUpNameForAddress({
    address,
    network,
  }: AddressOnNetwork): NameOnNetwork | undefined {
    const entry = this.addressBook.find(
      ({ address: entryAddress }) =>
        normalizeEVMAddress(entryAddress) === normalizeEVMAddress(address)
    )
    return entry ? { name: entry.name, network } : undefined
  }

  async lookUpAddressForContractName({
    name,
    network,
  }: NameOnNetwork): Promise<AddressOnNetwork | undefined> {
    return this.knownContracts.find(
      ({ name: entryName, network: entryNetwork }) =>
        sameNetwork(network, entryNetwork) && name === entryName
    )
  }

  async lookUpNameForContractAddress({
    address,
    network,
  }: AddressOnNetwork): Promise<NameOnNetwork | undefined> {
    return this.knownContracts.find(
      ({ address: entryAddress, network: entryNetwork }) =>
        sameNetwork(network, entryNetwork) &&
        normalizeEVMAddress(address) === normalizeEVMAddress(entryAddress)
    )
  }

  async deleteAccountSignerSettings(
    signer: AccountSignerWithId
  ): Promise<void> {
    const updatedSignerSettings = await this.db.deleteAccountSignerSettings(
      signer
    )

    this.emitter.emit("updatedSignerSettings", updatedSignerSettings)
  }

  async updateAccountSignerTitle(
    signer: AccountSignerWithId,
    title: string
  ): Promise<void> {
    const updatedSignerSettings = this.db.updateSignerTitle(signer, title)

    this.emitter.emit("updatedSignerSettings", await updatedSignerSettings)
  }

  async getAnalyticsPreferences(): Promise<Preferences["analytics"]> {
    return (await this.db.getPreferences())?.analytics
  }

  async updateAnalyticsPreferences(
    analyticsPreferences: Partial<AnalyticsPreferences>
  ): Promise<void> {
    await this.db.upsertAnalyticsPreferences(analyticsPreferences)
    const { analytics } = await this.db.getPreferences()

    // This step is not strictly needed, because the settings can only
    // be changed from the UI
    this.emitter.emit("updateAnalyticsPreferences", analytics)
  }

  async getAccountSignerSettings(): Promise<AccountSignerSettings[]> {
    return this.db.getAccountSignerSettings()
  }

  async getCurrency(): Promise<FiatCurrency> {
    return (await this.db.getPreferences())?.currency
  }

  async getTokenListPreferences(): Promise<TokenListPreferences> {
    return (await this.db.getPreferences())?.tokenLists
  }

  async getDefaultWallet(): Promise<boolean> {
    return (await this.db.getPreferences())?.defaultWallet
  }

  async setDefaultWalletValue(newDefaultWalletValue: boolean): Promise<void> {
    return this.db.setDefaultWalletValue(newDefaultWalletValue)
  }

  async getSelectedAccount(): Promise<AddressOnNetwork> {
    return (await this.db.getPreferences())?.selectedAccount
  }

  async setSelectedAccount(addressNetwork: AddressOnNetwork): Promise<void> {
    return this.db.setSelectedAccount(addressNetwork)
  }
}
