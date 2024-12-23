import { parse as parseRawTransaction } from "@ethersproject/transactions"

import HDKeyring, { SerializedHDKeyring } from "@tallyho/hd-keyring"

import { arrayify } from "ethers/lib/utils"
import { Wallet } from "ethers"
import { computeAllInputs } from "plume-sig"
import { normalizeEVMAddress, sameEVMAddress } from "../../lib/utils"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import {
  getEncryptedVaults,
  migrateVaultsToLatestVersion,
  writeLatestEncryptedVault,
} from "./storage"
import {
  decryptVault,
  deriveSymmetricKeyFromPassword,
  encryptVault,
  SaltedKey,
  VaultVersion,
} from "./encryption"
import { HexString, EIP712TypedData, UNIXTime } from "../../types"
import { SignedTransaction, TransactionRequestWithNonce } from "../../networks"

import BaseService from "../base"
import { FORK } from "../../constants"
import { ethersTransactionFromTransactionRequest } from "../chain/utils"
import { FeatureFlags, isEnabled } from "../../features"
import { AddressOnNetwork } from "../../accounts"
import logger from "../../lib/logger"
import PreferenceService from "../preferences"
import { DEFAULT_AUTOLOCK_INTERVAL } from "../preferences/defaults"
import { PLUMESigningResponse } from "../../utils/signing"

export enum SignerInternalTypes {
  mnemonicBIP39S128 = "mnemonic#bip39:128",
  mnemonicBIP39S256 = "mnemonic#bip39:256",
  metamaskMnemonic = "mnemonic#metamask",
  singleSECP = "single#secp256k1",
}

export enum SignerImportSource {
  import = "import",
  internal = "internal",
}

export enum SignerSourceTypes {
  privateKey = "privateKey",
  jsonFile = "jsonFile",
  keyring = "keyring",
}

export type Keyring = {
  type: SignerInternalTypes
  id: string
  path: string | null
  addresses: string[]
}
export type PrivateKey = Keyring & {
  type: SignerInternalTypes.singleSECP
  path: null
  addresses: [string]
}

export type KeyringAccountSigner = {
  type: "keyring"
  keyringID: string
}

export type PrivateKeyAccountSigner = {
  type: "private-key"
  walletID: string
}

type SerializedPrivateKey = {
  version: number
  id: string
  privateKey: string
}

type ImportMetadataHDKeyring = {
  type: SignerSourceTypes.keyring
  mnemonic: string
  source: SignerImportSource
  path?: string
}
type ImportMetadataPrivateKey = {
  type: SignerSourceTypes.privateKey
  privateKey: string
}
type ImportMetadataJSONPrivateKey = {
  type: SignerSourceTypes.jsonFile
  jsonFile: string
  password: string
}
export type SignerImportMetadata =
  | ImportMetadataPrivateKey
  | ImportMetadataHDKeyring
  | ImportMetadataJSONPrivateKey

type InternalSignerHDKeyring = {
  type: SignerSourceTypes.keyring
  signer: HDKeyring
}
type InternalSignerPrivateKey = {
  type: SignerSourceTypes.privateKey
  signer: Wallet
}
type InternalSignerWithType = InternalSignerPrivateKey | InternalSignerHDKeyring

interface SerializedKeyringData {
  privateKeys: SerializedPrivateKey[]
  keyrings: SerializedHDKeyring[]
  metadata: { [signerId: string]: { source: SignerImportSource } }
  hiddenAccounts: { [address: HexString]: boolean }
}

interface Events extends ServiceLifecycleEvents {
  locked: boolean
  internalSigners: {
    privateKeys: PrivateKey[]
    keyrings: Keyring[]
    metadata: {
      [signerId: string]: { source: SignerImportSource }
    }
  }
  address: string
  vaultMigrationCompleted:
    | { newVaultVersion: VaultVersion }
    | { errorMessage: string }
}

const isPrivateKey = (
  signer: InternalSignerWithType,
): signer is InternalSignerPrivateKey =>
  signer.type === SignerSourceTypes.privateKey

const isKeyring = (
  signer: InternalSignerWithType,
): signer is InternalSignerHDKeyring =>
  signer.type === SignerSourceTypes.keyring

/*
 * InternalSignerService is responsible for all key material, as well as applying the
 * material to sign messages, sign transactions, and derive child keypairs.
 *
 * The service can be in two states, locked or unlocked, and starts up locked.
 * Keys are persisted in encrypted form when the service is locked.
 *
 * When unlocked, the service automatically locks itself after it has not seen
 * activity for a certain amount of time. The service can be notified of
 * outside activity that should be considered for the purposes of keeping the
 * service unlocked. No keyring or keys activity for 30 minutes causes the service to
 * lock, while no outside activity for 30 minutes has the same effect.
 */
export default class InternalSignerService extends BaseService<Events> {
  #cachedKey: SaltedKey | null = null

  #cachedVaultVersion: VaultVersion = VaultVersion.PBKDF2

  #keyrings: HDKeyring[] = []

  #privateKeys: Wallet[] = []

  #signerMetadata: { [signerId: string]: { source: SignerImportSource } } = {}

  #hiddenAccounts: { [address: HexString]: boolean } = {}

  /**
   * The last time an internal signer took an action that required the service to be
   * unlocked (signing, adding a keyring, etc).
   */
  lastActivity: UNIXTime | undefined

  /**
   * The last time the service was notified of an outside activity.
   * {@see markOutsideActivity}
   */
  lastOutsideActivity: UNIXTime | undefined

  #internalAutoLockInterval: UNIXTime = DEFAULT_AUTOLOCK_INTERVAL

  static create: ServiceCreatorFunction<
    Events,
    InternalSignerService,
    [Promise<PreferenceService>]
  > = async (preferenceService) => new this(await preferenceService)

  private constructor(private preferenceService: PreferenceService) {
    super({
      autolock: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => {
          this.autolockIfNeeded()
        },
      },
    })
  }

  override async internalStartService(): Promise<void> {
    // Emit locked status on startup. Should always be locked, but the main
    // goal is to have external viewers synced to internal state no matter what
    // it is. Don't emit if there are no vaults to unlock.
    await super.internalStartService()

    this.#internalAutoLockInterval =
      await this.preferenceService.getAutoLockInterval()

    if ((await getEncryptedVaults()).vaults.length > 0) {
      this.emitter.emit("locked", this.locked())
    }
  }

  override async internalStopService(): Promise<void> {
    await this.lock()

    await super.internalStopService()
  }

  async updateAutoLockInterval(): Promise<void> {
    this.#internalAutoLockInterval =
      await this.preferenceService.getAutoLockInterval()

    await this.autolockIfNeeded()
  }

  /**
   * @return True if the service is locked, false if it is unlocked.
   */
  locked(): boolean {
    return this.#cachedKey === null
  }

  /**
   * Update activity timestamps and emit unlocked event.
   */
  #unlock(): void {
    this.lastActivity = Date.now()
    this.lastOutsideActivity = Date.now()
    this.emitter.emit("locked", false)
  }

  /**
   * Unlock the service with a provided password, initializing from the most
   * recently persisted keys vault if one exists.
   *
   * @param password A user-chosen string used to encrypt keys vaults.
   *        Unlocking will fail if an existing vault is found, and this password
   *        can't decrypt it.
   *
   *        Note that losing this password means losing access to any key
   *        material stored in a vault.
   * @param ignoreExistingVaults If true, ignore any existing, previously
   *        persisted vaults on unlock, instead starting with a clean slate.
   *        This option makes sense if a user has lost their password, and needs
   *        to generate a new vault.
   *
   *        Note that old vaults aren't deleted, and can still be recovered
   *        later in an emergency.
   * @returns true if the service was successfully unlocked using the password,
   *          and false otherwise.
   */
  async unlock(
    password: string,
    ignoreExistingVaults = false,
  ): Promise<boolean> {
    if (!this.locked()) {
      logger.warn("InternalSignerService is already unlocked!")
      this.#unlock()
      return true
    }

    const {
      encryptedData: { vaults, version },
      ...migrationResults
    } = await migrateVaultsToLatestVersion(password)
    this.#cachedVaultVersion = version

    if (migrationResults.migrated) {
      this.emitter.emit("vaultMigrationCompleted", { newVaultVersion: version })
    } else if (migrationResults.errorMessage !== undefined) {
      this.emitter.emit("vaultMigrationCompleted", {
        errorMessage: migrationResults.errorMessage,
      })
    }

    if (!ignoreExistingVaults) {
      const currentEncryptedVault = vaults.slice(-1)[0]?.vault
      if (currentEncryptedVault) {
        // attempt to load the vault
        const saltedKey = await deriveSymmetricKeyFromPassword(
          version,
          password,
          currentEncryptedVault.salt,
        )
        let plainTextVault: SerializedKeyringData
        try {
          plainTextVault = await decryptVault<SerializedKeyringData>({
            version,
            vault: currentEncryptedVault,
            passwordOrSaltedKey: saltedKey,
          })
          this.#cachedKey = saltedKey
        } catch (err) {
          // if we weren't able to load the vault, don't unlock
          return false
        }
        // hooray! vault is loaded, import any serialized keys
        this.#keyrings = []
        this.#signerMetadata = {}
        this.#privateKeys = []
        plainTextVault.keyrings.forEach((kr) => {
          this.#keyrings.push(HDKeyring.deserialize(kr))
        })

        plainTextVault.privateKeys?.forEach((pk) =>
          this.#privateKeys.push(new Wallet(pk.privateKey)),
        )

        this.#signerMetadata = {
          ...plainTextVault.metadata,
        }

        this.#hiddenAccounts = {
          ...plainTextVault.hiddenAccounts,
        }
      }
    }

    // if there's no vault or we want to force a new vault, generate a new key
    // and unlock
    if (!this.#cachedKey) {
      this.#cachedKey = await deriveSymmetricKeyFromPassword(version, password)
      await this.#persistInternalSigners()
    }

    this.#unlock()
    this.#emitInternalSigners()

    return true
  }

  /**
   * Lock the service, deleting references to the cached vault
   * encryption keys and keyrings.
   */
  async lock(): Promise<void> {
    this.lastActivity = undefined
    this.lastOutsideActivity = undefined
    this.#cachedKey = null
    this.#keyrings = []
    this.#signerMetadata = {}
    this.#privateKeys = []
    this.emitter.emit("locked", true)
    this.#emitInternalSigners()
  }

  /**
   * Notifies the service that an outside activity occurred. Outside activities
   * are used to delay autolocking.
   */
  markOutsideActivity(): void {
    if (typeof this.lastOutsideActivity !== "undefined") {
      this.lastOutsideActivity = Date.now()
    }
  }

  // Locks the service if the time since last service or outside activity
  // exceeds preset levels.
  private async autolockIfNeeded(): Promise<void> {
    if (
      typeof this.lastActivity === "undefined" ||
      typeof this.lastOutsideActivity === "undefined"
    ) {
      // Normally both activity counters should be undefined only if the service
      // is locked, otherwise they should both be set; regardless, fail safe if
      // either is undefined and the service is unlocked.
      if (!this.locked()) {
        await this.lock()
      }

      return
    }

    const now = Date.now()
    const timeSinceLastActivity = now - this.lastActivity
    const timeSinceLastOutsideActivity = now - this.lastOutsideActivity

    if (timeSinceLastActivity >= this.#internalAutoLockInterval) {
      this.lock()
    } else if (timeSinceLastOutsideActivity >= this.#internalAutoLockInterval) {
      this.lock()
    }
  }

  // Throw if the service is not unlocked; if it is, update the last service
  // activity timestamp.
  private requireUnlocked(): void {
    if (this.locked()) {
      throw new Error("InternalSignerService must be unlocked.")
    }

    this.lastActivity = Date.now()
    this.markOutsideActivity()
  }

  /**
   * Generate a new keyring
   *
   * @param type - the type of keyring to generate. Currently only supports 256-
   *        bit HD keys.
   * @returns An object containing the string ID of the new keyring and the
   *          mnemonic for the new keyring. Note that the mnemonic can only be
   *          accessed at generation time through this return value.
   */
  async generateNewKeyring(
    type: SignerInternalTypes,
    path?: string,
  ): Promise<{ id: string; mnemonic: string[] }> {
    this.requireUnlocked()

    if (type !== SignerInternalTypes.mnemonicBIP39S256) {
      throw new Error(
        "InternalSignerService only supports generating 256-bit HD key trees",
      )
    }

    const options: { strength: number; path?: string } = { strength: 256 }

    if (path) {
      options.path = path
    }

    const newKeyring = new HDKeyring(options)

    const { mnemonic } = newKeyring.serializeSync()

    return { id: newKeyring.id, mnemonic: mnemonic.split(" ") }
  }

  /**
   * Import new internal signer
   *
   * @param signerMetadata any signer with type and metadata
   * @returns null | string - if new account was added or existing account was found then returns an address
   */
  async importSigner(
    signerMetadata: SignerImportMetadata,
  ): Promise<HexString | null> {
    this.requireUnlocked()
    try {
      let address: HexString | null

      if (signerMetadata.type === SignerSourceTypes.privateKey) {
        address = this.#importPrivateKey(signerMetadata.privateKey)
      } else if (signerMetadata.type === SignerSourceTypes.jsonFile) {
        const { jsonFile, password } = signerMetadata
        address = await this.#importJSON(jsonFile, password)
      } else {
        const { mnemonic, source, path } = signerMetadata
        address = this.#importKeyring(mnemonic, source, path)
      }

      this.#hiddenAccounts[address] = false
      await this.#persistInternalSigners()
      this.emitter.emit("address", address)
      this.#emitInternalSigners()

      return address
    } catch (error) {
      logger.error("Signer import failed:", error)
      return null
    }
  }

  /**
   * Import keyring and pull the first address from that
   * keyring for system use.
   *
   * @param signerMetadata - keyring metadata - path, source, mnemonic
   * @returns string - address of the first account from the HD keyring
   */
  #importKeyring(
    mnemonic: string,
    source: SignerImportSource,
    path?: string,
  ): string {
    const newKeyring = path
      ? new HDKeyring({ mnemonic, path })
      : new HDKeyring({ mnemonic })

    const existingKeyring = this.#keyrings.find((kr) => kr.id === newKeyring.id)

    if (existingKeyring) {
      const [address] = existingKeyring.getAddressesSync()
      return address
    }
    this.#keyrings.push(newKeyring)
    const [address] = newKeyring.addAddressesSync(1)

    // If address was previously imported as a private key then remove it
    if (this.#findPrivateKey(address)) {
      this.#removePrivateKey(address)
    }

    this.#signerMetadata[newKeyring.id] = { source }

    return address
  }

  /**
   * Import private key with a string
   * @param privateKey - string
   * @returns string - address of imported or existing account
   */
  #importPrivateKey(privateKey: string): string {
    const newWallet = new Wallet(privateKey)
    const normalizedAddress = normalizeEVMAddress(newWallet.address)

    if (this.#findSigner(normalizedAddress)) {
      return normalizedAddress
    }

    this.#privateKeys.push(newWallet)
    this.#signerMetadata[normalizedAddress] = {
      source: SignerImportSource.import,
    }
    return normalizedAddress
  }

  /**
   * Import private key with JSON file
   * @param jsonFile - stringified JSON file
   * @param password - string
   * @returns string - address of imported or existing account
   */
  async #importJSON(jsonFile: string, password: string): Promise<string> {
    const newWallet = await Wallet.fromEncryptedJson(jsonFile, password)
    const normalizedAddress = normalizeEVMAddress(newWallet.address)

    if (this.#findSigner(normalizedAddress)) {
      return normalizedAddress
    }

    this.#privateKeys.push(newWallet)
    this.#signerMetadata[normalizedAddress] = {
      source: SignerImportSource.import,
    }
    return normalizedAddress
  }

  /**
   * Return the source of a given address' signer if it exists. If an
   * address does not have a internal signer associated with it - returns null.
   */
  getSignerSourceForAddress(address: string): SignerImportSource | null {
    const signerWithType = this.#findSigner(address)

    if (!signerWithType) return null

    if (isKeyring(signerWithType)) {
      return this.#signerMetadata[signerWithType.signer.id].source
    }
    return this.#signerMetadata[
      normalizeEVMAddress(signerWithType.signer.address)
    ].source
  }

  /**
   * Return an array of keyring representations that can safely be stored and
   * used outside the extension.
   */
  getKeyrings(): Keyring[] {
    this.requireUnlocked()

    return this.#keyrings.map((kr) => ({
      // TODO this type is meanlingless from the library's perspective.
      // Reconsider, or explicitly track which keyrings have been generated vs
      // imported as well as their strength
      type: SignerInternalTypes.mnemonicBIP39S256,
      addresses: [
        ...kr
          .getAddressesSync()
          .filter((address) => this.#hiddenAccounts[address] !== true),
      ],
      id: kr.id,
      path: kr.path,
    }))
  }

  /**
   * Returns and array of private keys representations that can safely be stored
   * and used outside the extension
   */
  getPrivateKeys(): PrivateKey[] {
    this.requireUnlocked()

    return this.#privateKeys.map((wallet) => ({
      type: SignerInternalTypes.singleSECP,
      addresses: [normalizeEVMAddress(wallet.address)],
      id: wallet.publicKey,
      path: null,
    }))
  }

  /**
   * Derive and return the next address for a KeyringAccountSigner representing
   * an HDKeyring.
   *
   * @param keyringAccountSigner - A KeyringAccountSigner representing the
   *        given keyring.
   */
  async deriveAddress({ keyringID }: KeyringAccountSigner): Promise<HexString> {
    this.requireUnlocked()

    // find the keyring using a linear search
    const keyring = this.#keyrings.find((kr) => kr.id === keyringID)
    if (!keyring) {
      throw new Error("Keyring not found.")
    }

    const keyringAddresses = keyring.getAddressesSync()

    // If There are any hidden addresses, show those first before adding new ones.
    const newAddress =
      keyringAddresses.find(
        (address) => this.#hiddenAccounts[address] === true,
      ) ?? keyring.addAddressesSync(1)[0]

    this.#hiddenAccounts[newAddress] = false

    // If address was previously imported as a private key then remove it
    if (this.#findPrivateKey(newAddress)) {
      this.#removePrivateKey(newAddress)
    }

    await this.#persistInternalSigners()

    this.emitter.emit("address", newAddress)
    this.#emitInternalSigners()

    return newAddress
  }

  /**
   * Remove signer from the service's memory.
   * If it was imported with a private key then it will be completely removed from the service.
   * If address belongs to the keyring then we will hide it without removing from underlying keyring.
   * If that address is the last one from a given keyring then we will remove whole keyring.
   *
   * @param address account to be removed from UI
   */
  async removeAccount(address: HexString): Promise<void> {
    this.#hiddenAccounts[address] = true

    const keyringSigner = this.#findKeyring(address)
    const privateKeySigner = this.#findPrivateKey(address)

    if (keyringSigner === null && privateKeySigner === null) return

    if (keyringSigner !== null) {
      const keyringAddresses = await keyringSigner.getAddresses()

      if (
        keyringAddresses.every(
          (keyringAddress) => this.#hiddenAccounts[keyringAddress] === true,
        )
      ) {
        keyringAddresses.forEach((keyringAddress) => {
          delete this.#hiddenAccounts[keyringAddress]
        })
        this.#removeKeyring(keyringSigner.id)
      }
    }

    if (privateKeySigner !== null) {
      this.#removePrivateKey(address)
    }

    await this.#persistInternalSigners()
    this.#emitInternalSigners()
  }

  #removeKeyring(keyringId: string): HDKeyring[] {
    const filteredKeyrings = this.#keyrings.filter(
      (keyring) => keyring.id !== keyringId,
    )

    if (filteredKeyrings.length === this.#keyrings.length) {
      throw new Error(
        `Attempting to remove keyring that does not exist. id: (${keyringId})`,
      )
    }
    this.#keyrings = filteredKeyrings
    delete this.#signerMetadata[keyringId]

    return filteredKeyrings
  }

  #removePrivateKey(address: HexString): Wallet[] {
    const filteredPrivateKeys = this.#privateKeys.filter(
      (wallet) => !sameEVMAddress(wallet.address, address),
    )

    if (filteredPrivateKeys.length === this.#privateKeys.length) {
      throw new Error(
        `Attempting to remove wallet that does not exist. Address: (${address})`,
      )
    }

    this.#privateKeys = filteredPrivateKeys
    delete this.#signerMetadata[normalizeEVMAddress(address)]

    return filteredPrivateKeys
  }

  /**
   * Export private key - supprts exporting from both private key wallet signers and
   * HD Wallet's specific accounts
   *
   * @param address
   * @returns string | null - private key string if it was exported successfully
   */
  async exportPrivateKey(address: HexString): Promise<string | null> {
    this.requireUnlocked()

    const signerWithType = this.#findSigner(address)

    if (!signerWithType) {
      logger.error(`Export private key for address ${address} failed`)
      return null
    }

    if (isPrivateKey(signerWithType)) {
      return signerWithType.signer.privateKey
    }

    return signerWithType.signer.exportPrivateKey(
      address,
      "I solemnly swear that I am treating this private key material with great care.",
    )
  }

  /**
   * Export mnemonic from HD wallet
   *
   * @param address
   * @returns string | null - mnemonic string if it was exported successfully
   */
  async exportMnemonic(address: HexString): Promise<string | null> {
    this.requireUnlocked()

    const keyring = this.#findKeyring(address)

    if (!keyring) {
      logger.error(`Export mnemonic for address ${address} failed.`)
      return null
    }

    const { mnemonic } = await keyring.serialize()
    return mnemonic
  }

  /**
   * Find keyring associated with an account.
   *
   * @param account - the account address desired to search the keyring for.
   * @returns HD keyring object
   */
  #findKeyring(account: HexString): HDKeyring | null {
    const keyring = this.#keyrings.find((kr) =>
      kr.getAddressesSync().includes(normalizeEVMAddress(account)),
    )

    return keyring ?? null
  }

  /**
   * Find a wallet imported with a private key
   *
   * @param account - the account address desired to search the wallet for.
   * @returns Ether's Wallet object
   */
  #findPrivateKey(account: HexString): Wallet | null {
    const privateKey = this.#privateKeys.find((item) =>
      sameEVMAddress(item.address, account),
    )

    return privateKey ?? null
  }

  /**
   * Find a signer object associated with a given account address
   */
  #findSigner(account: HexString): InternalSignerWithType | null {
    const keyring = this.#findKeyring(account)

    if (keyring) {
      return {
        signer: keyring,
        type: SignerSourceTypes.keyring,
      }
    }

    const privateKey = this.#findPrivateKey(account)

    if (privateKey) {
      return {
        signer: privateKey,
        type: SignerSourceTypes.privateKey,
      }
    }

    return null
  }

  /**
   * Sign a transaction.
   *
   * @param account - the account desired to sign the transaction
   * @param txRequest
   */
  async signTransaction(
    addressOnNetwork: AddressOnNetwork,
    txRequest: TransactionRequestWithNonce,
  ): Promise<SignedTransaction> {
    this.requireUnlocked()

    const { address: account, network } = addressOnNetwork

    // find the signer using a linear search
    const signerWithType = this.#findSigner(account)

    if (!signerWithType) {
      throw new Error(
        `Signing transaction failed. Signer for address ${account} was not found.`,
      )
    }

    // ethers has a looser / slightly different request type
    const ethersTxRequest = ethersTransactionFromTransactionRequest(txRequest)

    let signedRawTx: string

    // unfortunately, ethers gives us a serialized signed tx here
    if (isPrivateKey(signerWithType)) {
      signedRawTx = await signerWithType.signer.signTransaction(ethersTxRequest)
    } else {
      signedRawTx = await signerWithType.signer.signTransaction(
        account,
        ethersTxRequest,
      )
    }

    // parse the tx, then unpack it as best we can
    const tx = parseRawTransaction(signedRawTx)

    if (!tx.hash || !tx.from || !tx.r || !tx.s || typeof tx.v === "undefined") {
      throw new Error("Transaction doesn't appear to have been signed.")
    }

    const {
      to,
      gasPrice,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      hash,
      from,
      nonce,
      data,
      value,
      type,
      r,
      s,
      v,
    } = tx

    if (
      typeof maxPriorityFeePerGas === "undefined" ||
      typeof maxFeePerGas === "undefined" ||
      type !== 2
    ) {
      const signedTx = {
        hash,
        from,
        to,
        nonce,
        input: data,
        value: value.toBigInt(),
        type: type as 0,
        gasPrice: gasPrice?.toBigInt() ?? null,
        gasLimit: gasLimit.toBigInt(),
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        r,
        s,
        v,
        blockHash: null,
        blockHeight: null,
        asset: network.baseAsset,
        network: isEnabled(FeatureFlags.USE_MAINNET_FORK) ? FORK : network,
      }
      return signedTx
    }

    // TODO move this to a helper function
    const signedTx: SignedTransaction = {
      hash,
      from,
      to,
      nonce,
      input: data,
      value: value.toBigInt(),
      type,
      gasPrice: null,
      maxFeePerGas: maxFeePerGas.toBigInt(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toBigInt(),
      gasLimit: gasLimit.toBigInt(),
      r,
      s,
      v,
      blockHash: null,
      blockHeight: null,
      asset: network.baseAsset,
      network: isEnabled(FeatureFlags.USE_MAINNET_FORK) ? FORK : network,
    }

    return signedTx
  }

  /**
   * Sign typed data based on EIP-712 with the usage of eth_signTypedData_v4 method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-712
   *
   * @param typedData - the data to be signed
   * @param account - signers account address
   */
  async signTypedData({
    typedData,
    account,
  }: {
    typedData: EIP712TypedData
    account: HexString
  }): Promise<string> {
    this.requireUnlocked()
    const { domain, types, message } = typedData
    const signerWithType = this.#findSigner(account)

    if (!signerWithType) {
      throw new Error(
        `Signing data failed. Signer for address ${account} was not found.`,
      )
    }

    // When signing we should not include EIP712Domain type
    const { EIP712Domain: _, ...typesForSigning } = types
    try {
      let signature: string
      if (isPrivateKey(signerWithType)) {
        // eslint-disable-next-line no-underscore-dangle
        signature = await signerWithType.signer._signTypedData(
          domain,
          typesForSigning,
          message,
        )
      } else {
        signature = await signerWithType.signer.signTypedData(
          account,
          domain,
          typesForSigning,
          message,
        )
      }

      return signature
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }

  /**
   * Sign data based on EIP-191 with the usage of personal_sign method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-191
   *
   * @param signingData - the data to be signed
   * @param account - signers account address
   */
  async personalSign({
    signingData,
    account,
  }: {
    signingData: HexString
    account: HexString
  }): Promise<string> {
    this.requireUnlocked()
    const signerWithType = this.#findSigner(account)

    if (!signerWithType) {
      throw new Error(
        `Personal sign failed. Signer for address ${account} was not found.`,
      )
    }

    const messageBytes = arrayify(signingData)
    try {
      let signature: string
      if (isPrivateKey(signerWithType)) {
        signature = await signerWithType.signer.signMessage(messageBytes)
      } else {
        signature = await signerWithType.signer.signMessageBytes(
          account,
          messageBytes,
        )
      }

      return signature
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }

  /**
   * Generate a Pseudonymously Linked Unique Message Entity based on EIP-7524 with the usage of eth_getPlumeSignature method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-7524
   *
   * @param message - the message to generate a PLUME for
   * @param account - signers account address
   */
  async generatePLUME({
    message,
    account,
    version,
  }: {
    message: string
    account: HexString
    version?: number
  }): Promise<PLUMESigningResponse> {
    this.requireUnlocked()
    const signerWithType = this.#findSigner(account)

    if (!signerWithType) {
      throw new Error(
        `PLUME generation failed. Signer for address ${account} was not found.`,
      )
    }

    try {
      let privateKey
      if (isPrivateKey(signerWithType)) {
        privateKey = signerWithType.signer.privateKey
      } else {
        privateKey = await signerWithType.signer.exportPrivateKey(
          account,
          "I solemnly swear that I am treating this private key material with great care.",
        )
      }
      if (!privateKey) {
        throw new Error("Private key unavailable")
      }
      if (privateKey.startsWith("0x")) {
        privateKey = privateKey.substring(2)
      }

      const { plume, s, publicKey, c, gPowR, hashMPKPowR } =
        await computeAllInputs(message, privateKey, undefined, version)

      return {
        plume: `0x${plume.toHex(true)}`,
        publicKey: `0x${Buffer.from(publicKey).toString("hex")}`,
        hashMPKPowR: `0x${hashMPKPowR.toHex(true)}`,
        gPowR: `0x${gPowR.toHex(true)}`,
        c: `0x${c}`,
        s: `0x${s}`,
      }
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }

  #emitInternalSigners(): void {
    if (this.locked()) {
      this.emitter.emit("internalSigners", {
        privateKeys: [],
        keyrings: [],
        metadata: {},
      })
    } else {
      const keyrings = this.getKeyrings()
      const privateKeys = this.getPrivateKeys()
      this.emitter.emit("internalSigners", {
        privateKeys,
        keyrings,
        metadata: { ...this.#signerMetadata },
      })
    }
  }

  /**
   * Serialize, encrypt, and persist all HDKeyrings and private keys.
   */
  async #persistInternalSigners(): Promise<void> {
    this.requireUnlocked()

    // This if guard will always pass due to requireUnlocked, but statically
    // prove it to TypeScript.
    if (this.#cachedKey !== null) {
      const serializedKeyrings: SerializedHDKeyring[] = this.#keyrings.map(
        (kr) => kr.serializeSync(),
      )
      const serializedPrivateKeys: SerializedPrivateKey[] =
        this.#privateKeys.map((wallet) => ({
          version: 1,
          id: wallet.publicKey,
          privateKey: wallet.privateKey,
        }))
      const hiddenAccounts = { ...this.#hiddenAccounts }
      const metadata = { ...this.#signerMetadata }
      serializedKeyrings.sort((a, b) => (a.id > b.id ? 1 : -1))
      const vault = await encryptVault({
        version: this.#cachedVaultVersion,
        passwordOrSaltedKey: this.#cachedKey,
        vault: {
          keyrings: serializedKeyrings,
          privateKeys: serializedPrivateKeys,
          metadata,
          hiddenAccounts,
        },
      })
      await writeLatestEncryptedVault(vault)
    }
  }
}
