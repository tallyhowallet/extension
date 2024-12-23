import React, { ReactElement } from "react"
import { selectPLUMESigningData } from "@tallyho/tally-background/redux-slices/signing"
import { useBackgroundSelector } from "../hooks"
import Signing from "../components/Signing"

export default function PLUMESign(): ReactElement {
  const PLUMEsigningDataRequest = useBackgroundSelector(selectPLUMESigningData)

  return <Signing request={PLUMEsigningDataRequest} />
}
