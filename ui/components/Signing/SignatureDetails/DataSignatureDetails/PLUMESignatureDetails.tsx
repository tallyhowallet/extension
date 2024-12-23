import { PLUMESigningRequest } from "@tallyho/tally-background/utils/signing"
import React, { ReactElement } from "react"
import EIP7524Info from "../../../SignData/EIP7524Info"
import DataSignatureDetails from "."

export type PLUMESignatureDetailsProps = {
  PLUMERequest: PLUMESigningRequest
}

export default function PLUMESignatureDetails({
  PLUMERequest,
}: PLUMESignatureDetailsProps): ReactElement {
  return (
    <DataSignatureDetails
      alternativeTitle="Your signature is requested to generate a Pseudonymously
    Linked Unique Message Entity (PLUME) for the following message:"
    >
      <EIP7524Info signingData={PLUMERequest.rawSigningData} />
    </DataSignatureDetails>
  )
}
