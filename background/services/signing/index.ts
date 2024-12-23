import { StatusCodes, TransportStatusError } from "@ledgerhq/errors"
import InternalSignerService, {
  KeyringAccountSigner,
  PrivateKeyAccountSigner,
} from "../internal-signer"
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
import { PLUMESigningResponse } from "../../utils/signing"

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

export type PLUMESignatureResponse =
  | {
      type: "success-data"
      plume: PLUMESigningResponse
    }
  | ErrorResponse

type Events = ServiceLifecycleEvents & {
  signingTxResponse: TXSignatureResponse
  signingDataResponse: SignatureResponse
  personalSigningResponse: SignatureResponse
  PLUMESigningResponse: PLUMESignatureResponse
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
  | PrivateKeyAccountSigner
  | KeyringAccountSigner
  | HardwareAccountSigner
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
      Promise<InternalSignerService>,
      Promise<LedgerService>,
      Promise<ChainService>,
    ]
  > = async (internalSignerService, ledgerService, chainService) =>
    new this(
      await internalSignerService,
      await ledgerService,
      await chainService,
    )

  private constructor(
    private internalSignerService: InternalSignerService,
    private ledgerService: LedgerService,
    private chainService: ChainService,
  ) {
    super()
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService() // Not needed, but better to stick to the patterns
  }

  async deriveAddress(signerID: AccountSigner): Promise<HexString> {
    if (signerID.type === "ledger") {
      return this.ledgerService.deriveAddress(signerID)
    }

    if (signerID.type === "keyring") {
      return this.internalSignerService.deriveAddress(signerID)
    }

    throw new Error(`Unknown signerID: ${signerID}`)
  }

  private async signTransactionWithNonce(
    transactionWithNonce: TransactionRequestWithNonce,
    accountSigner: AccountSigner,
  ): Promise<SignedTransaction> {
    switch (accountSigner.type) {
      case "ledger":
        return this.ledgerService.signTransaction(
          transactionWithNonce,
          accountSigner,
        )
      case "private-key":
      case "keyring":
        return this.internalSignerService.signTransaction(
          {
            address: transactionWithNonce.from,
            network: transactionWithNonce.network,
          },
          transactionWithNonce,
        )
      case "read-only":
        throw new Error("Read-only signers cannot sign.")
      default:
        return assertUnreachable(accountSigner)
    }
  }

  async removeAccount(
    address: HexString,
    signerType?: SignerType,
  ): Promise<void> {
    if (signerType) {
      switch (signerType) {
        case "private-key":
        case "keyring":
          await this.internalSignerService.removeAccount(address)
          break
        case "ledger":
          await this.ledgerService.removeAddress(address)
          break
        case "read-only":
          break // no additional work here, just account removal below
        default:
          assertUnreachable(signerType)
      }
    }
    await this.chainService.removeAccountToTrack(address)
  }

  /**
   * Requests that signers prepare for a signing request. For hardware wallets
   * in particular, this can include refreshing connection information so that
   * the status is up to date. For remote wallets, e.g. WalletConnect, it can
   * include connection setup.
   *
   * Currently this method does not take information about the request, but if
   * the required setup is expensive enough, the `from` address can be passed
   * in so that signers are only set up when the request applies to them.
   */
  async prepareForSigningRequest(): Promise<void> {
    // Refresh connected Ledger info indiscriminately. No real harm vs doing it
    // only under certain circumstances, might even be more performant than
    // testing whether the Ledger can sign for the requested `from` address.
    await this.ledgerService.refreshConnectedLedger()
  }

  async signTransaction(
    transactionRequest: TransactionRequest,
    accountSigner: AccountSigner,
  ): Promise<SignedTransaction> {
    const transactionWithNonce =
      await this.chainService.populateEVMTransactionNonce(transactionRequest)

    try {
      const signedTx = await this.signTransactionWithNonce(
        transactionWithNonce,
        accountSigner,
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
          "Attempting to sign typed data with mismatched chain IDs.",
        )
      }

      switch (accountSigner.type) {
        case "ledger":
          signedData = await this.ledgerService.signTypedData(
            typedData,
            account.address,
            accountSigner,
          )
          break
        case "private-key":
        case "keyring":
          signedData = await this.internalSignerService.signTypedData({
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
    accountSigner: AccountSigner,
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
            hexDataToSign,
          )
          break
        case "private-key":
        case "keyring":
          signedData = await this.internalSignerService.personalSign({
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

  async signPLUME(
    addressOnNetwork: AddressOnNetwork,
    dataToSign: string,
    accountSigner: AccountSigner,
    version?: number,
  ): Promise<PLUMESigningResponse> {
    try {
      let plume: PLUMESigningResponse
      switch (accountSigner.type) {
        case "ledger":
          throw new Error(
            "Ledger does not currently support generating PLUMEs.",
          )
          break
        case "private-key":
        case "keyring":
          plume = await this.internalSignerService.generatePLUME({
            message: dataToSign,
            account: addressOnNetwork.address,
            version,
          })
          break
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          assertUnreachable(accountSigner)
      }

      this.emitter.emit("PLUMESigningResponse", {
        type: "success-data",
        plume,
      })
      return plume
    } catch (err) {
      if (err instanceof TransportStatusError) {
        const transportError = err as Error & { statusCode: number }
        switch (transportError.statusCode) {
          case StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED:
            this.emitter.emit("PLUMESigningResponse", {
              type: "error",
              reason: "userRejected",
            })
            throw err
          default:
            break
        }
      }
      this.emitter.emit("PLUMESigningResponse", {
        type: "error",
        reason: "genericError",
      })
      throw err
    }
  }
}
