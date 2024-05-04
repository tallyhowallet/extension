import React, { ReactElement } from "react"
import classNames from "classnames"

type TabBarIconButtonProps = {
  title: string
  icon: string
  isActive: boolean
  showNotifications?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export default function TabBarIconButton(
  props: TabBarIconButtonProps,
): ReactElement {
  const { icon, title, isActive, showNotifications = false, onClick } = props

  return (
    <button type="button" role="link" onClick={onClick}>
      <div className={classNames("tab_bar_icon_wrap", { active: isActive })}>
        {showNotifications && (
          <div className="notifications">
            <div className="dot" />
          </div>
        )}
        <div className={classNames("icon")} />
        <span>{title}</span>
      </div>
      <style jsx>
        {`
          .tab_bar_icon_wrap {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            justify-items: center;
            transform: translateY(0px) translateZ(0);
            transition: transform 0.3s ease;
            -webkit-backface-visibility: hidden;
            will-change: transform;
          }
          .icon {
            mask-image: url("./images/${icon}.svg");
            mask-size: cover;
            width: 24px;
            height: 24px;
            cursor: pointer;
            background-color: var(--green-40);
            transition: transform 0.1s ease;
          }
          span {
            position: absolute;
            opacity: 0;
            text-align: center;
            margin-bottom: -39px;
            color: var(--green-40);
            font-size: 12px;
            font-weight: 600;
            text-transform: capitalize;
            transition:
              opacity 0.3s ease,
              color 0.1s ease;
          }
          .active .icon {
            background-color: var(--trophy-gold);
            opacity: 1;
          }
          .tab_bar_icon_wrap:hover span,
          .active span {
            opacity: 1;
          }
          .tab_bar_icon_wrap:hover:not(.active) span,
          .active span {
            color: var(--green-20);
          }
          .tab_bar_icon_wrap:hover,
          .active {
            transform: translateY(-8px) translateZ(0);
          }
          .tab_bar_icon_wrap:hover:not(.active) .icon {
            background-color: var(--green-20);
          }
          .active span {
            color: var(--trophy-gold);
          }
          .notifications {
            width: 10px;
            height: 10px;
            right: -2px;
            top: -2px;
            background: var(--hunter-green);
            position: absolute;
            z-index: var(--z-base);
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--success);
          }
        `}
      </style>
    </button>
  )
}

TabBarIconButton.defaultProps = {
  isActive: false,
}
