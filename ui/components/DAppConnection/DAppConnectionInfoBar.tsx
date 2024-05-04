import classNames from "classnames"
import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  markDismissableItemAsShown,
  selectShouldShowDismissableItem,
} from "@tallyho/tally-background/redux-slices/ui"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedIcon from "../Shared/SharedIcon"
import DAppConnectionDefaultToggle from "./DAppConnectionDefaultToggle"

type PopoverProps = {
  close: () => void
}

function DefaultConnectionPopover({ close }: PopoverProps): ReactElement {
  const { t: tShared } = useTranslation("translation", { keyPrefix: "shared" })
  const { t } = useTranslation("translation", {
    keyPrefix: "dAppConnect.defaultConnectionPopover",
  })

  const [isClosing, setIsClosing] = useState(false)

  const animateThenClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(close, 300)
  }, [close])

  return (
    <div
      className={classNames("bg", {
        fade_in: !isClosing,
        fade_out: isClosing,
      })}
    >
      <section>
        <SharedIcon
          id="close"
          icon="close.svg"
          width={12}
          aria-label={tShared("close")}
          onClick={animateThenClose}
          color="var(--green-20)"
          hoverColor="var(--white)"
          style={{ position: "absolute", top: 16, right: 16 }}
        />

        <h3>{t("title")}</h3>

        <p>{t("activeWallet")}</p>
        <p>{t("activeWalletMeaning")}</p>

        <h4>{t("metaMaskHeading")}</h4>

        <div className="default-toggle">
          {t("toggleLabel")}
          <DAppConnectionDefaultToggle alwaysForceSelection="taho" />
        </div>
      </section>
      <button
        aria-label={tShared("modalClose")}
        type="button"
        className="void_space"
        onClick={animateThenClose}
      />
      <style jsx>{`
        .bg {
          position: fixed;
          top: 48px;
          left: 0px;
          width: 100%;
          height: 100%;

          background-color: color-mix(
            in srgb,
            var(--green-120),
            transparent 30%
          );

          z-index: var(--z-content;
        }

        section {
          position: absolute;
          top: 16px;

          display: flex;
          flex-direction: column;

          margin: 0 6px 0 16px;
          padding: 10px 16px 20px 20px;

          color: var(--green-20);

          background-color: var(--green-120);
          border: 1px solid var(--green-80);
          border-radius: 16px;
          box-shadow:
            0 10px 12px rgba(0, 20, 19, 0.34),
            0 14px 16px rgba(0, 20, 19, 0.24),
            0 24px 24px rgba(0, 20, 19, 0.14);
        }

        section:before,
        section:after {
          content: "";
          position: absolute;
          top: -10px;
          left: 28px;
        }

        section:before {
          transform: rotate(45deg);

          width: 17px;
          height: 17px;

          border: 1px var(--green-80);
          border-style: solid none none solid;
          border-top-left-radius: 6px;

          background-color: var(--green-120);
        }

        section:after {
          top: -7px;
          left: 30px;

          width: 0;
          height: 0;

          border: 7px transparent;
          border-style: none solid solid;
          border-bottom-color: var(--success);
          border-top-left-radius: 3px;
        }

        h3 {
          font-size: 22px;
          color: var(--success);

          margin: 0 0 12px;
        }

        p {
          font-weight: 500;

          margin: 0 0 4px;
        }

        h4 {
          color: var(--white);

          margin: 21px 0 14px;
        }

        div.default-toggle {
          display: flex;

          flex-direction: row;
          align-items: center;
        }

        .void_space {
          height: 100%;
          width: 100%;
          position: fixed;
          top: 0;
          left: 0;
          z-index: var(--z-backdrop);
        }
      `}</style>
    </div>
  )
}

/**
 * Component to show the toggle for using Taho as the default vs non-default
 * wallet when the user tries to connect a dApp. This toggle can be used to
 * switch to a different wallet right in the connection flow.
 */
export default function DAppConnectionInfoBar(): ReactElement {
  const dispatch = useBackgroundDispatch()

  const shouldImmediatelyShowPopover = useBackgroundSelector(
    selectShouldShowDismissableItem("default-connection-popover"),
  )

  const [
    isShowingDefaultConnectionPopover,
    setIsShowingDefaultConnectionPopover,
  ] = useState(shouldImmediatelyShowPopover)

  const closeDefaultConnectionPopover = useCallback(() => {
    if (shouldImmediatelyShowPopover && isShowingDefaultConnectionPopover) {
      dispatch(markDismissableItemAsShown("default-connection-popover"))
    }

    setIsShowingDefaultConnectionPopover(false)
  }, [
    dispatch,
    isShowingDefaultConnectionPopover,
    shouldImmediatelyShowPopover,
  ])

  const toggleIsShowingDefaultConnectionPopover = useCallback(() => {
    if (isShowingDefaultConnectionPopover) {
      closeDefaultConnectionPopover()
    } else {
      setIsShowingDefaultConnectionPopover(true)
    }
  }, [closeDefaultConnectionPopover, isShowingDefaultConnectionPopover])

  return (
    <section
      className={classNames({ highlighted: isShowingDefaultConnectionPopover })}
    >
      <SharedIcon
        onClick={() => toggleIsShowingDefaultConnectionPopover()}
        icon="icons/m/info.svg"
        width={16}
        hoverColor="var(--success)"
        color={
          isShowingDefaultConnectionPopover
            ? "var(--success)"
            : "var(--green-20)"
        }
      />
      {isShowingDefaultConnectionPopover && (
        <DefaultConnectionPopover close={closeDefaultConnectionPopover} />
      )}

      <DAppConnectionDefaultToggle />

      <style jsx>{`
        section {
          background-color: var(--green-120);
          padding: 10px 16px 10px 4px;

          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;

          gap: 8px;

          // These exist so that they can be switched to the success
          // color below.
          border-top: 1px solid var(--green-120);
          border-bottom: 1px solid var(--hunter-green);
        }

        section.highlighted {
          border-color: var(--success);
        }
      `}</style>
    </section>
  )
}
