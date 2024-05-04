import React, { ReactElement, CSSProperties, useRef } from "react"
import classNames from "classnames"
import { useDelayContentChange, useOnClickOutside } from "../../hooks"
import SharedIcon from "./SharedIcon"

export type SharedSlideUpMenuSize =
  | "auto"
  | "small"
  | "medium"
  | "large"
  | "custom"

const SLIDE_TRANSITION_MS = 445

type Props = {
  isOpen: boolean
  close: (
    e:
      | MouseEvent
      | TouchEvent
      | React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => void
  children: React.ReactNode
  customSize?: string
  size: SharedSlideUpMenuSize
  isFullScreen?: boolean
  isScrollable?: boolean
  allowOverflow?: boolean
  isDark?: boolean
  alwaysRenderChildren?: boolean
  testid?: string
  style?: CSSProperties
}

const menuHeights: Record<SharedSlideUpMenuSize, string | null> = {
  auto: "auto",
  small: "268px",
  medium: "536px",
  large: "600px",
  custom: null,
}
export default function SharedSlideUpMenu(props: Props): ReactElement {
  const {
    isOpen,
    close,
    size,
    children,
    customSize,
    isFullScreen,
    isDark,
    isScrollable,
    allowOverflow,
    alwaysRenderChildren,
    testid = "slide_up_menu",
    style,
  } = props

  const slideUpMenuRef = useRef(null)

  useOnClickOutside(slideUpMenuRef, close)

  // Continue showing children during the close transition.
  const visibleChildren = (isOpen || alwaysRenderChildren) && children
  const displayChildren = useDelayContentChange(
    visibleChildren,
    !isOpen,
    SLIDE_TRANSITION_MS,
  )

  const menuHeight = menuHeights[size] ?? customSize ?? menuHeights.medium

  return (
    <>
      <div className={classNames("overlay", { closed: !isOpen })} />
      <div
        className={classNames("slide_up_menu", {
          dark: isDark,
          closed: !isOpen,
          scrollable: isScrollable,
          with_overflow: allowOverflow,
        })}
        data-testid={testid}
        style={{ "--menu-height": menuHeight, ...style } as CSSProperties}
        ref={isOpen ? slideUpMenuRef : null}
      >
        <div
          className={classNames("slide_up_close", {
            hover_content: isFullScreen,
          })}
        >
          <SharedIcon
            icon="close.svg"
            width={12}
            color="var(--green-20)"
            hoverColor="#fff"
            ariaLabel="Close menu"
            onClick={(e) => {
              close(e)
            }}
          />
        </div>
        {displayChildren}
      </div>
      <style jsx>
        {`
          .slide_up_menu {
            width: 100%;
            height: var(--menu-height);
            overflow-x: hidden;
            overflow-y: hidden;
            border-radius: ${isFullScreen ? "0" : "16px 16px 0 0"};
            background-color: var(--green-95);
            position: fixed;
            left: 0px;
            right: 0px;
            bottom: 0px;
            z-index: var(--z-menu);
            transform: translateY(0); /* open by default */
            opacity: 1;
            transition: transform cubic-bezier(0.19, 1, 0.22, 1)
              ${SLIDE_TRANSITION_MS}ms;
            padding-top: ${isFullScreen ? "0" : "24px"};
            box-sizing: border-box;
          }
          .slide_up_menu.scrollable {
            overflow-y: auto;
          }
          .slide_up_menu.with_overflow {
            overflow-y: visible;
            overflow-x: visible;
          }
          .overlay {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            top: 0;
            cursor: pointer;
            z-index: var(--z-below-menu);
            background: var(--green-120);
            opacity: 0.7;
            transition:
              opacity cubic-bezier(0.19, 1, 0.22, 1) 0.445s,
              visiblity 0.445s;
          }
          .overlay.closed {
            opacity: 0;
            visiblity: hidden;
            pointer-events: none;
          }
          .dark {
            background-color: var(--hunter-green);
          }
          .slide_up_menu.closed {
            transform: translateY(100%);
            transition:
              transform cubic-bezier(0.19, 1, 0.22, 1) ${SLIDE_TRANSITION_MS}ms,
              // Drop opacity all at once at the end.
              opacity 0ms ${SLIDE_TRANSITION_MS}ms;
            opacity: 0;
            pointer-events: none;
          }
          .slide_up_close {
            position: absolute;
            z-index: var(--z-settings);
            top: 24px;
            right: 24px;
          }
          .slide_up_close.hover_content {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(0, 20, 19, 0.75);
            padding: 8px;
            border-radius: 100%;
          }
        `}
      </style>
    </>
  )
}

SharedSlideUpMenu.defaultProps = {
  size: "medium",
  isFullScreen: false,
}
