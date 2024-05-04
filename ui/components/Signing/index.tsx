import React, { ReactElement } from "react"
import {
  getAccountTotal,
  selectCurrentAccountSigner,
} from "@tallyho/tally-background/redux-slices/selectors"
import { SignOperationType } from "@tallyho/tally-background/redux-slices/signing"
import { useBackgroundSelector } from "../../hooks"
import {
  ResolvedSignatureDetails,
  useResolvedSignatureDetails,
} from "./SignatureDetails"
import SharedSkeletonLoader from "../Shared/SharedSkeletonLoader"
import SignerFrame from "./Signer/SignerFrame"
import SigningLoading from "./SigningLoading"
import SigningNetworkAccountInfoTopBar from "./SigningNetworkAccountInfoTopBar"

// Signing acts as a dispatcher, so prop spreading is a good tradeoff.
// The explicit prop and component types ease the linter rule's concern around
// forwarding unintended props. Disable the rule for the rest of the file
// accordingly.
/* eslint-disable react/jsx-props-no-spreading */

type SigningLoadedProps<T extends SignOperationType> = {
  request: T
  signatureDetails: ResolvedSignatureDetails
}

// Wrapped component that is used when all signing-related data is known to be
// loaded.
function SigningLoaded<T extends SignOperationType>({
  request,
  signatureDetails,
}: SigningLoadedProps<T>): ReactElement {
  const { signingAddress, renderedSigningData } = signatureDetails

  const signerAccountTotal = useBackgroundSelector((state) =>
    getAccountTotal(state, signingAddress),
  )

  return (
    <section>
      <SharedSkeletonLoader
        isLoaded={signerAccountTotal !== undefined}
        height={32}
        width={120}
        style={{ margin: "15px 0 15px 220px" }}
      >
        {signerAccountTotal !== undefined && (
          <SigningNetworkAccountInfoTopBar accountTotal={signerAccountTotal} />
        )}
      </SharedSkeletonLoader>
      <SignerFrame request={request} {...signatureDetails}>
        {renderedSigningData}
      </SignerFrame>
      <style jsx>
        {`
          section {
            width: 100%;
            min-height: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: var(--green-95);
            z-index: var(--z-section);
          }
          section :global(h1.title) {
            color: var(--trophy-gold);
            font-size:;
            font-weight: 500;
            line-height: 42px;
            text-align: center;
          }
          section > :global(footer) {
            position: fixed;
            bottom: 0px;
            display: flex;
            width: 100%;
            padding: 0px 16px;
            box-sizing: border-box;
            align-items: center;
            height: 80px;
            justify-content: space-between;
            box-shadow: 0 0 5px rgba(0, 20, 19, 0.5);
            background-color: var(--green-95);
          }
        `}
      </style>
    </section>
  )
}

type SigningProps<T extends SignOperationType> = {
  request: T | undefined
}

/**
 * The Signing component is an umbrella component that renders all
 * signing-related UI. It handles choosing the correct UI to present the data
 * being signed to the user, as well as the correct UI for the signer executing
 * the actual signature, and delegates control of the UI to the signer.
 */
export default function Signing<T extends SignOperationType>({
  request,
}: SigningProps<T>): ReactElement {
  const accountSigner = useBackgroundSelector(selectCurrentAccountSigner)
  const signatureDetails = useResolvedSignatureDetails(
    request === undefined
      ? undefined
      : {
          request,
          accountSigner,
        },
  )

  // Note that signatureDetails should only be undefined if request is
  // undefined.
  if (request === undefined || signatureDetails === undefined) {
    return <SigningLoading />
  }

  return <SigningLoaded request={request} signatureDetails={signatureDetails} />
}
