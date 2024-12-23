import {
  fixedPointNumberToString,
  multiplyFixedPointNumbers,
} from "@tallyho/tally-background/lib/fixed-point"
import {
  EIP1559TransactionRequest,
  LegacyEVMTransactionRequest,
} from "@tallyho/tally-background/networks"
import { SignOperationType } from "@tallyho/tally-background/redux-slices/signing"
import { DisplayDetails } from "@tallyho/tally-background/services/ledger"
import { EIP712TypedData } from "@tallyho/tally-background/types"
import { ethers } from "ethers"
import { _TypedDataEncoder } from "ethers/lib/utils"
import React, { ReactElement } from "react"
import TransactionDetailContainer from "../../../../TransactionDetail/TransactionDetailContainer"
import TransactionDetailItem from "../../../../TransactionDetail/TransactionDetailItem"

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! //
// !!                                                                     !! //
// !! Note that ~none of the strings in this file are internationalized   !! //
// !! This is because the strings in this file reflect the actual UI of   !! //
// !! the Ledger hardware wallet, which is only ever rendered in English! !! //
// !!                                                                     !! //
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! //

type SignerLedgerSigningProps<T extends SignOperationType> = {
  request: T
  isArbitraryDataSigningRequired: boolean
  displayDetails: DisplayDetails
}

function SignerLedgerSigningMessage({
  message,
  displayDetails: ledgerDisplayDetails,
}: {
  message: string
  displayDetails: DisplayDetails
}): ReactElement {
  return (
    <TransactionDetailContainer>
      <TransactionDetailItem name="Sign message" value="" />
      <TransactionDetailItem
        name="Message" /* intentionally not i18ned, see above */
        value={`${message.substring(
          0,
          ledgerDisplayDetails.messageSigningDisplayLength - 3,
        )}…`}
      />
    </TransactionDetailContainer>
  )
}
/* intentionally not i18ned, see above */
function SignerLedgerSigningTypedData({
  typedData,
}: {
  typedData: EIP712TypedData
}): ReactElement {
  const { EIP712Domain: _, ...typesForSigning } = typedData.types

  // Below, we prefix the 0x so that we can uppercase the hex characters
  // without uppercasing the X. This is because the Ledger displays hex
  // characters all uppercase for this operation, but an uppercased X
  // both makes our display and the Ledger's less accurate and makes it
  // harder to scan the values.
  const domainHash = `0x${_TypedDataEncoder
    .hashDomain(typedData.domain)
    .substring(2)
    .toUpperCase()}`
  const messageHash = `0x${_TypedDataEncoder
    .from(typesForSigning)
    .hash(typedData.message)
    .substring(2)
    .toUpperCase()}`

  return (
    <TransactionDetailContainer>
      <TransactionDetailItem
        name="Sign typed message" /* intentionally not i18ned, see above */
        value=""
      />
      <TransactionDetailItem
        name="Domain hash" /* intentionally not i18ned, see above */
        value={domainHash}
      />
      <TransactionDetailItem
        name="Message hash" /* intentionally not i18ned, see above */
        value={messageHash}
      />
    </TransactionDetailContainer>
  )
}

function SignerLedgerSigningTransaction({
  transactionRequest,
  isArbitraryDataSigningRequired,
}: {
  transactionRequest: EIP1559TransactionRequest | LegacyEVMTransactionRequest
  isArbitraryDataSigningRequired: boolean
}): ReactElement {
  const ethAmountString = fixedPointNumberToString({
    amount: transactionRequest.value,
    decimals: transactionRequest.network.baseAsset.decimals,
  })
  const maxFeeAmountString = fixedPointNumberToString(
    multiplyFixedPointNumbers(
      {
        amount:
          "maxFeePerGas" in transactionRequest
            ? transactionRequest.maxFeePerGas
            : transactionRequest.gasPrice,
        decimals: transactionRequest.network.baseAsset.decimals,
      },
      { amount: transactionRequest.gasLimit, decimals: 0 },
    ),
  )

  return (
    <>
      <TransactionDetailContainer>
        <TransactionDetailItem
          name="Review transaction" /* intentionally not i18ned, see above */
          value=""
        />
        {isArbitraryDataSigningRequired && (
          <TransactionDetailItem
            name="Blind signing" /* intentionally not i18ned, see above */
            value=""
          />
        )}
        <TransactionDetailItem
          name="Amount" /* intentionally not i18ned, see above */
          value={`ETH ${ethAmountString}`}
        />
        <TransactionDetailItem
          name="Address" /* intentionally not i18ned, see above */
          value={
            transactionRequest.to !== undefined
              ? ethers.utils.getAddress(transactionRequest.to)
              : "Contract" /* intentionally not i18ned, see above */
          }
        />
        <TransactionDetailItem
          name="Max fees" /* intentionally not i18ned, see above */
          value={`ETH ${maxFeeAmountString}`}
        />
      </TransactionDetailContainer>

      <footer className="cannot_reject_warning">
        <span className="block_icon" />
        Tx can only be Rejected from Ledger
      </footer>
    </>
  )
}

export default function SignerLedgerSigning<T extends SignOperationType>({
  request,
  isArbitraryDataSigningRequired,
  displayDetails,
}: SignerLedgerSigningProps<T>): ReactElement {
  if ("signingData" in request) {
    const message =
      typeof request.signingData === "string"
        ? request.signingData
        : request.signingData.unparsedMessageData

    return (
      <SignerLedgerSigningMessage
        message={message}
        displayDetails={displayDetails}
      />
    )
  }

  if ("typedData" in request) {
    return <SignerLedgerSigningTypedData typedData={request.typedData} />
  }

  if ("plumeVersion" in request) {
    throw new Error("PLUME signing is not supported by Ledger.")
  }

  return (
    <SignerLedgerSigningTransaction
      transactionRequest={request}
      isArbitraryDataSigningRequired={isArbitraryDataSigningRequired}
    />
  )
}
