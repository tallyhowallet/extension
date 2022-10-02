import { StatusCodes, TransportStatusError } from "@ledgerhq/errors"
import KeyringService, { KeyringAccountSigner } from "../keyring"
import LedgerService, { LedgerAccountSigner } from "../ledger"
import {
  SignedTransaction,
  TransactionRequest,
  TransactionRequestWithNonce,
} from "../../networks"
import { EIP712TypedData, HexString } from "../../types"
import BaseService from "../base"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import ChainService from "../chain"
import { AddressOnNetwork } from "../../accounts"
import { assertUnreachable } from "../../lib/utils/type-guards"
import QRHardwareService, { QRHardwareAccountSigner } from "../qr-hardware"

type SigningErrorReason = "userRejected" | "genericError"
type ErrorResponse = {
  type: "error"
  reason: SigningErrorReason
}

export type TXSignatureResponse =
  | {
      type: "success-tx"
      signedTx: SignedTransaction
    }
  | ErrorResponse

export type SignatureResponse =
  | {
      type: "success-data"
      signedData: string
    }
  | ErrorResponse

type Events = ServiceLifecycleEvents & {
  signingTxResponse: TXSignatureResponse
  signingDataResponse: SignatureResponse
  personalSigningResponse: SignatureResponse
}

/**
 * An AccountSigner that represents a read-only account. Read-only accounts
 * generally cannot sign.
 */
export const ReadOnlyAccountSigner = { type: "read-only" } as const

/**
 * An AccountSigner carries the appropriate information for a given signer to
 * act on a signing request. The `type` field always carries the signer type,
 * but the rest of the object is signer-specific and should be treated as
 * opaque outside of the specific signer's service.
 */
export type AccountSigner =
  | typeof ReadOnlyAccountSigner
  | KeyringAccountSigner
  | HardwareAccountSigner
  | QRHardwareAccountSigner
export type HardwareAccountSigner = LedgerAccountSigner

export type SignerType = AccountSigner["type"]

type AddressHandler = {
  address: string
  signer: SignerType
}

function getSigningErrorReason(err: unknown): SigningErrorReason {
  if (err instanceof TransportStatusError) {
    const transportError = err as Error & { statusCode: number }
    switch (transportError.statusCode) {
      case StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED:
        return "userRejected"
      default:
    }
  }

  return "genericError"
}

/**
 * The SigningService is intended hide and demultiplex of accesses
 * to concrete signer implementations.
 *
 * It also emits all the abstract signing-related event to subscribers
 * grabbing this responsibility from each different implementation.
 *
 */
export default class SigningService extends BaseService<Events> {
  addressHandlers: AddressHandler[] = []

  static create: ServiceCreatorFunction<
    Events,
    SigningService,
    [
      Promise<KeyringService>,
      Promise<LedgerService>,
      Promise<QRHardwareService>,
      Promise<ChainService>
    ]
  > = async (
    keyringService,
    ledgerService,
    qrHardwareService,
    chainService
  ) => {
    return new this(
      await keyringService,
      await ledgerService,
      await qrHardwareService,
      await chainService
    )
  }

  private constructor(
    private keyringService: KeyringService,
    private ledgerService: LedgerService,
    private qrHardwareService: QRHardwareService,
    private chainService: ChainService
  ) {
    super()
  }

  protected async internalStartService(): Promise<void> {
    await super.internalStartService() // Not needed, but better to stick to the patterns
  }

  async deriveAddress(signerID: AccountSigner): Promise<HexString> {
    if (signerID.type === "ledger") {
      return this.ledgerService.deriveAddress(signerID)
    }

    if (signerID.type === "keyring") {
      return this.keyringService.deriveAddress(signerID)
    }

    if (signerID.type === "qr-hardware") {
      return this.qrHardwareService.deriveAddress(signerID)
    }

    throw new Error(`Unknown signerID: ${signerID}`)
  }

  private async signTransactionWithNonce(
    transactionWithNonce: TransactionRequestWithNonce,
    accountSigner: AccountSigner
  ): Promise<SignedTransaction> {
    switch (accountSigner.type) {
      case "ledger":
        return this.ledgerService.signTransaction(
          transactionWithNonce,
          accountSigner
        )
      case "keyring":
        return this.keyringService.signTransaction(
          {
            address: transactionWithNonce.from,
            network: transactionWithNonce.network,
          },
          transactionWithNonce
        )
      case "qr-hardware":
        return this.qrHardwareService.signTransaction(
          transactionWithNonce,
          accountSigner
        )
      case "read-only":
        throw new Error("Read-only signers cannot sign.")
      default:
        return assertUnreachable(accountSigner)
    }
  }

  async removeAccount(
    address: HexString,
    signerType?: SignerType
  ): Promise<void> {
    if (signerType) {
      switch (signerType) {
        case "keyring":
          await this.keyringService.hideAccount(address)
          break
        case "ledger":
          await this.ledgerService.removeAddress(address)
          break
        case "qr-hardware":
          // todo
          break
        case "read-only":
          break // no additional work here, just account removal below
        default:
          assertUnreachable(signerType)
      }
    }
    await this.chainService.removeAccountToTrack(address)
  }

  async signTransaction(
    transactionRequest: TransactionRequest,
    accountSigner: AccountSigner
  ): Promise<SignedTransaction> {
    const transactionWithNonce =
      await this.chainService.populateEVMTransactionNonce(transactionRequest)

    try {
      const signedTx = await this.signTransactionWithNonce(
        transactionWithNonce,
        accountSigner
      )

      this.emitter.emit("signingTxResponse", {
        type: "success-tx",
        signedTx,
      })

      return signedTx
    } catch (err) {
      this.emitter.emit("signingTxResponse", {
        type: "error",
        reason: getSigningErrorReason(err),
      })

      this.chainService.releaseEVMTransactionNonce(transactionWithNonce)

      throw err
    }
  }

  addTrackedAddress(address: string, handler: SignerType): void {
    this.addressHandlers.push({ address, signer: handler })
  }

  async signTypedData({
    typedData,
    account,
    accountSigner,
  }: {
    typedData: EIP712TypedData
    account: AddressOnNetwork
    accountSigner: AccountSigner
  }): Promise<string> {
    try {
      let signedData: string
      const chainId =
        typeof typedData.domain.chainId === "string"
          ? // eslint-disable-next-line radix
            parseInt(typedData.domain.chainId)
          : typedData.domain.chainId
      if (
        typedData.domain.chainId !== undefined &&
        // Let parseInt infer radix by prefix; chainID can be hex or decimal,
        // though it should generally be hex.
        // eslint-disable-next-line radix
        chainId !== parseInt(account.network.chainID)
      ) {
        throw new Error(
          "Attempting to sign typed data with mismatched chain IDs."
        )
      }

      switch (accountSigner.type) {
        case "ledger":
          signedData = await this.ledgerService.signTypedData(
            typedData,
            account.address,
            accountSigner
          )
          break
        case "qr-hardware":
          signedData = await this.qrHardwareService.signTypedData(
            typedData,
            account.address,
            accountSigner
          )
          break
        case "keyring":
          signedData = await this.keyringService.signTypedData({
            typedData,
            account: account.address,
          })
          break
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          assertUnreachable(accountSigner)
      }
      this.emitter.emit("signingDataResponse", {
        type: "success-data",
        signedData,
      })

      return signedData
    } catch (err) {
      this.emitter.emit("signingDataResponse", {
        type: "error",
        reason: getSigningErrorReason(err),
      })

      throw err
    }
  }

  async signData(
    addressOnNetwork: AddressOnNetwork,
    hexDataToSign: HexString,
    accountSigner: AccountSigner
  ): Promise<string> {
    if (!hexDataToSign.startsWith("0x")) {
      throw new Error("Signing service can only sign hex data.")
    }

    try {
      let signedData
      switch (accountSigner.type) {
        case "ledger":
          signedData = await this.ledgerService.signMessage(
            addressOnNetwork,
            hexDataToSign
          )
          break
        case "qr-hardware":
          signedData = await this.keyringService.personalSign({
            signingData: hexDataToSign,
            account: addressOnNetwork.address,
          })
          break
        case "keyring":
          signedData = await this.keyringService.personalSign({
            signingData: hexDataToSign,
            account: addressOnNetwork.address,
          })
          break
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          assertUnreachable(accountSigner)
      }

      this.emitter.emit("personalSigningResponse", {
        type: "success-data",
        signedData,
      })
      return signedData
    } catch (err) {
      if (err instanceof TransportStatusError) {
        const transportError = err as Error & { statusCode: number }
        switch (transportError.statusCode) {
          case StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED:
            this.emitter.emit("personalSigningResponse", {
              type: "error",
              reason: "userRejected",
            })
            throw err
          default:
            break
        }
      }
      this.emitter.emit("personalSigningResponse", {
        type: "error",
        reason: "genericError",
      })
      throw err
    }
  }
}
