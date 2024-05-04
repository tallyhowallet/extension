import {
  claimRewards,
  selectClaimSelections,
  selectIsDelegationSigned,
  signTokenDelegationData,
  selectCurrentlyClaiming,
} from "@tallyho/tally-background/redux-slices/claim"
import React, { ReactElement, useCallback, useMemo } from "react"
import { useHistory } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import SharedProgressIndicator from "../Shared/SharedProgressIndicator"

interface ClaimFooterProps {
  step: number
  advanceStep: () => void
  showSuccess: () => void
  isAdvanceable: boolean
}

export default function ClaimFooter({
  step,
  advanceStep,
  showSuccess,
  isAdvanceable,
}: ClaimFooterProps): ReactElement {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()

  const { selectedDelegate } = useBackgroundSelector(selectClaimSelections)
  const isDelegationSigned = useBackgroundSelector(selectIsDelegationSigned)
  const isCurrentlyClaiming = useBackgroundSelector(selectCurrentlyClaiming)
  const claimState = useBackgroundSelector((state) => state.claim)

  const lastStepButtonText = useMemo(() => {
    if (selectedDelegate.address !== undefined && !isDelegationSigned) {
      return "Sign Delegation"
    }
    return "Claim"
  }, [isDelegationSigned, selectedDelegate.address])

  const buttonText = useMemo(
    () => ["Get started", "Continue", "I'm In", "Continue", lastStepButtonText],
    [lastStepButtonText],
  )

  if (isCurrentlyClaiming) {
    showSuccess()
  }
  const handleClick = useCallback(async () => {
    // FIXME Set state to pending so SignTransaction doesn't redirect back; drop after
    // FIXME proper transaction queueing is in effect.
    if (buttonText[step - 1] === "Sign Delegation") {
      dispatch(signTokenDelegationData())
      history.push("/sign-data")
    } else if (buttonText[step - 1] === "Claim") {
      await dispatch(claimRewards(claimState))
    } else {
      advanceStep()
    }
  }, [buttonText, step, advanceStep, dispatch, claimState, history])

  return (
    <footer>
      <div className="steps">
        {step < 5 && (
          <SharedProgressIndicator
            activeStep={step - 1}
            onProgressStepClicked={() => {}}
            numberOfSteps={3}
            noInteraction
          />
        )}
      </div>
      <SharedButton
        type="primary"
        size="medium"
        onClick={handleClick}
        isDisabled={isCurrentlyClaiming || !isAdvanceable}
      >
        {buttonText[step - 1]}
      </SharedButton>
      <style jsx>
        {`
          footer {
            position: relative;
            width: 352px;
            z-index: var(--z-settings);
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 0 auto;
          }
          .steps {
            display: flex;
            width: 100px;
          }
          .active {
            width: 16px;
            height: 6px;
            background: var(--trophy-gold);
            border-radius: 100px;
            transition: all 0.5s ease-out;
            margin: 0 2px;
          }
          .inactive {
            width: 6px;
            height: 6px;
            background: var(--green-60);
            border-radius: 100px;
            transition: all 0.5s ease-in;
            margin: 0 2px;
          }
        `}
      </style>
    </footer>
  )
}
