import React, { ReactElement } from "react"
import {
  isEnrichedEVMTransactionRequest,
  TransactionRequest,
} from "@tallyho/tally-background/networks"
import {
  rejectDataSignature,
  signData,
  SignOperation,
  SignOperationType,
  signTypedData,
  signPLUME,
} from "@tallyho/tally-background/redux-slices/signing"
import {
  rejectTransactionSignature,
  signTransaction,
} from "@tallyho/tally-background/redux-slices/transaction-construction"
import {
  MessageSigningRequest,
  PLUMESigningRequest,
  SignTypedDataRequest,
} from "@tallyho/tally-background/utils/signing"
import { AccountSigner } from "@tallyho/tally-background/services/signing"
import { AddressOnNetwork } from "@tallyho/tally-background/accounts"
import { AnyAction } from "redux"
import TransactionSignatureDetails from "./TransactionSignatureDetails"
import MessageDataSignatureDetails from "./DataSignatureDetails/MessageDataSignatureDetails"
import TypedDataSignatureDetails from "./DataSignatureDetails/TypedDataSignatureDetails"
import PLUMESignatureDetails from "./DataSignatureDetails/PLUMESignatureDetails"

/**
 * Details regarding a signature request, resolved for a signer ahead of time
 * based on the type of signature, the account whose signature is being
 * requested, and the network on which that signature is taking place; see
 * `resolveSignatureDetails`.
 */
export type ResolvedSignatureDetails = {
  signer: AccountSigner
  signingAddress: AddressOnNetwork
  renderedSigningData: ReactElement
  /**
   * A string that represents what signing this data will achieve. Some
   * signers may ignore this string, others may use it for their confirmation
   * button.
   */
  signingActionLabelI18nKey:
    | "signTransaction.confirmButtonLabel"
    // FIXME Move out of signTransaction once old flow is removed???
    | "signTransaction.signTypedData.confirmButtonLabel"
  signActionCreator: () => AnyAction
  rejectActionCreator: () => AnyAction
  /**
   * The value determines whether to redirect the user to the activity page after submitting a transaction
   */
  redirectToActivityPage?: boolean
}

export function resolveTransactionSignatureDetails({
  request,
  accountSigner,
}: SignOperation<TransactionRequest>): ResolvedSignatureDetails {
  const annotation = isEnrichedEVMTransactionRequest(request)
    ? request.annotation
    : undefined

  return {
    signer: accountSigner,
    signingAddress: { address: request.from, network: request.network },
    signingActionLabelI18nKey: "signTransaction.confirmButtonLabel",
    renderedSigningData: (
      <TransactionSignatureDetails transactionRequest={request} />
    ),
    signActionCreator: () => signTransaction({ request, accountSigner }),
    rejectActionCreator: rejectTransactionSignature,
    redirectToActivityPage: annotation?.type === "asset-swap",
  }
}
export function resolveDataSignatureDetails({
  request,
  accountSigner,
}: SignOperation<MessageSigningRequest>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: request.account,
    signingActionLabelI18nKey: "signTransaction.confirmButtonLabel",
    renderedSigningData: (
      <MessageDataSignatureDetails messageRequest={request} />
    ),
    signActionCreator: () => signData({ request, accountSigner }),
    rejectActionCreator: rejectDataSignature,
  }
}

export function resolveTypedDataSignatureDetails({
  request,
  accountSigner,
}: SignOperation<SignTypedDataRequest>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: request.account,
    signingActionLabelI18nKey:
      "signTransaction.signTypedData.confirmButtonLabel",
    renderedSigningData: (
      <TypedDataSignatureDetails typedDataRequest={request} />
    ),
    signActionCreator: () => signTypedData({ request, accountSigner }),
    rejectActionCreator: rejectDataSignature,
  }
}

export function resolvePLUMESignatureDetails({
  request,
  accountSigner,
}: SignOperation<PLUMESigningRequest>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: request.account,
    signingActionLabelI18nKey: "signTransaction.confirmButtonLabel",
    renderedSigningData: <PLUMESignatureDetails PLUMERequest={request} />,
    signActionCreator: () => signPLUME({ request, accountSigner }),
    rejectActionCreator: rejectDataSignature,
  }
}

// Takes a signing request and resolves the signer that should be used to sign
// it and the details of signing data for user presentation.
export function resolveSignatureDetails<T extends SignOperationType>({
  request,
  accountSigner,
}: SignOperation<T>): ResolvedSignatureDetails {
  if ("signingData" in request) {
    return resolveDataSignatureDetails({ request, accountSigner })
  }
  if ("typedData" in request) {
    return resolveTypedDataSignatureDetails({ request, accountSigner })
  }
  if ("plumeVersion" in request) {
    return resolvePLUMESignatureDetails({ request, accountSigner })
  }
  return resolveTransactionSignatureDetails({ request, accountSigner })
}

export function useResolvedSignatureDetails<T extends SignOperationType>(
  signOperation: SignOperation<T> | undefined,
): ResolvedSignatureDetails | undefined {
  return signOperation === undefined
    ? undefined
    : resolveSignatureDetails(signOperation)
}
