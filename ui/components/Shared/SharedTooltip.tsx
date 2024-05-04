import classNames from "classnames"
import React, { CSSProperties, ReactElement, useEffect, useState } from "react"

type VerticalPosition = "top" | "bottom"
type HorizontalPosition = "left" | "center" | "right"

interface Props {
  verticalPosition?: VerticalPosition
  horizontalPosition?: HorizontalPosition
  horizontalShift?: number
  verticalShift?: number
  width?: number
  height?: number
  type?: "default" | "dark"
  isOpen?: boolean
  disabled?: boolean
  children: React.ReactNode
  style?: CSSProperties & Record<string, unknown>
  // TODO: find a better way to tell the IconComponent that the tooltip it open
  IconComponent?: ({
    isShowingTooltip,
  }: {
    isShowingTooltip: boolean
  }) => ReactElement
}

function getHorizontalPosition(
  horizontal: HorizontalPosition,
  width: number,
  horizontalShift: number,
) {
  switch (horizontal) {
    case "center":
      return `right: -${width / 2 + 4 - horizontalShift}px;`
    case "right":
      return `right: -${width + 8 - horizontalShift}px;`
    case "left":
      return `left: -${width + 8 - horizontalShift}px;`
    default:
      return ""
  }
}

function getVerticalPosition(
  vertical: VerticalPosition,
  height: number,
  verticalShift: number,
) {
  switch (vertical) {
    case "bottom":
      return `top: ${height - verticalShift}px; margin-top: 5px;`
    case "top":
      return `bottom: ${height - verticalShift}px; margin-bottom: 5px;`
    default:
      return ""
  }
}

export default function SharedTooltip(props: Props): ReactElement {
  const {
    children,
    verticalPosition = "bottom",
    horizontalPosition = "center",
    horizontalShift = 0,
    verticalShift = 0,
    width,
    height = 20,
    type = "default",
    isOpen = false,
    disabled = false,
    IconComponent,
    style,
  } = props
  const [isShowingTooltip, setIsShowingTooltip] = useState(isOpen)

  useEffect(() => {
    setIsShowingTooltip(isOpen)
  }, [isOpen])

  return (
    <div
      data-testid="tooltip_wrap"
      className="tooltip_wrap"
      onMouseEnter={() => {
        setIsShowingTooltip(true)
      }}
      onMouseLeave={() => {
        setIsShowingTooltip(false)
      }}
      style={style}
    >
      {IconComponent ? (
        <IconComponent isShowingTooltip={isShowingTooltip} />
      ) : (
        <div className="info_icon" />
      )}
      {!disabled && isShowingTooltip ? (
        <div
          className={classNames("tooltip", {
            dark: type === "dark",
          })}
        >
          {children}
        </div>
      ) : null}
      <style jsx>
        {`
          .tooltip_wrap {
            width: fit-content;
            display: block;
            position: relative;
            padding: 5px 0;
            margin: -5px 0 -5px 8px;
          }
          .info_icon {
            mask-image: url("./images/icons/m/info.svg");
            mask-size: cover;
            background-color: var(--tooltip-icon-color, var(--green-40));
            width: 16px;
            height: 16px;
            display: block;
          }
          .tooltip {
            width: ${width !== undefined ? `${width}px` : "auto"};
            position: absolute;
            box-shadow:
              0 2px 4px rgba(0, 20, 19, 0.24),
              0 6px 8px rgba(0, 20, 19, 0.14),
              0 16px 16px rgba(0, 20, 19, 0.04);
            background-color: var(--green-20);
            color: var(--green-95);
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            border-radius: 3px;
            padding: 12px;
            z-index: var(--z-tooltip);
            ${getVerticalPosition(verticalPosition, height, verticalShift)}
            ${width !== undefined
              ? getHorizontalPosition(
                  horizontalPosition,
                  width,
                  horizontalShift,
                )
              : ""}
          }
          .dark {
            background: var(--green-120);
            color: var(--green-20);
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: 0.03em;
            line-height: 16px;
            text-align: center;
            padding: 8px;
          }
        `}
      </style>
    </div>
  )
}
