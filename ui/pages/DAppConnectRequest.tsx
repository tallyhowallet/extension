import React, { ReactElement, useCallback, useEffect } from "react"
import {
  selectCurrentPendingPermission,
  selectCurrentAccountTotal,
} from "@tallyho/tally-background/redux-slices/selectors"
import {
  denyOrRevokePermission,
  grantPermission,
} from "@tallyho/tally-background/redux-slices/dapp"

import { Redirect } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks"
import DAppConnectPage from "./DAppConnect/DAppConnectPage"
import ErrorFallback from "./ErrorFallback"

export default function DAppConnectRequest(): ReactElement {
  const dispatch = useBackgroundDispatch()

  const currentAccountTotal = useBackgroundSelector(selectCurrentAccountTotal)
  const permission = useBackgroundSelector(selectCurrentPendingPermission)

  useEffect(() => {
    window.onbeforeunload = () => {
      if (typeof permission !== "undefined") {
        dispatch(
          denyOrRevokePermission({
            ...permission,
            state: "deny",
          }),
        )
      }
    }
  }, [dispatch, permission])

  const grant = useCallback(async () => {
    if (
      typeof permission !== "undefined" &&
      typeof currentAccountTotal !== "undefined"
    ) {
      dispatch(
        grantPermission({
          ...permission,
          accountAddress: currentAccountTotal.address, // make sure address is matching current account
          state: "allow",
        }),
      )
    }
    window.onbeforeunload = null
    window.close()
  }, [dispatch, permission, currentAccountTotal])

  const deny = useCallback(async () => {
    // The denyOrRevokePermission will be dispatched in the onbeforeunload effect
    window.close()
  }, [])

  if (typeof permission === "undefined") {
    // something went wrong with permissions request
    return <ErrorFallback />
  }

  if (typeof currentAccountTotal === "undefined") {
    // there is no account, let's onboard first
    return <Redirect to="/onboarding/info-intro" />
  }

  return (
    <div className="page">
      <DAppConnectPage
        permission={permission}
        currentAccountTotal={currentAccountTotal}
        denyPermission={deny}
        grantPermission={grant}
      />
      <style jsx>{`
        .page {
          background-color: var(--green-95);
          height: 100vh;
          width: 100%;
          z-index: var(--z-over-menu);
        }
      `}</style>
      <style jsx global>{`
        body {
          background-color: var(--green-95);
        }
      `}</style>
    </div>
  )
}
