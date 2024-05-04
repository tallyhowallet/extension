import React, { ReactElement, useState } from "react"
import classNames from "classnames"
import { useDispatch, useSelector } from "react-redux"
import {
  selectShowNotifications,
  setShouldShowNotifications,
} from "@tallyho/tally-background/redux-slices/ui"
import SharedIcon from "../Shared/SharedIcon"

export default function WalletSubspaceLink(): ReactElement {
  const dispatch = useDispatch()
  const shouldShowNotifications = useSelector(selectShowNotifications)
  const [isIconOnly, setIsIconOnly] = useState(true)

  const onClick = () => {
    if (!shouldShowNotifications) {
      dispatch(setShouldShowNotifications(true))
    }

    window.open("https://app.taho.xyz/", "_blank")?.focus()
  }

  return (
    <button
      type="button"
      className={classNames("subscape_link", { icon_only: isIconOnly })}
      onClick={onClick}
      onMouseEnter={() => setIsIconOnly(false)}
      onMouseLeave={() => setIsIconOnly(true)}
    >
      <SharedIcon
        icon="subscape-logo.svg"
        width={22}
        color="var(--subscape)"
        style={{ marginRight: 10 }}
      />
      <span>Subscape Beta</span>
      <SharedIcon
        icon="new_tab@2x.png"
        width={16}
        color="var(--trophy-gold)"
        style={{ marginLeft: 5 }}
      />
      <style jsx>{`
        .subscape_link {
          cursor: pointer;
          position: absolute;
          z-index: var(--z-below-menu); // Above the UI, below the menu
          right: 0;
          top: 90;
          transform: translateX(0px);
          transition: transform 0.3s ease-in-out;
          padding: 5px 10px 5px 5px;
          border-radius: 16px 0 0 16px;
          display: flex;
          align-items: center;
          color: var(--trophy-gold);
          font-size: 18px;
          font-weight: 600;
          background: var(--subscape-background);
          box-shadow:
            0px 10px 12px 0px rgba(7, 17, 17, 0.34),
            0px 14px 16px 0px rgba(7, 17, 17, 0.24),
            0px 24px 24px 0px rgba(7, 17, 17, 0.14);
        }
        .subscape_link.icon_only {
          transform: translateX(160px);
        }
      `}</style>
    </button>
  )
}
