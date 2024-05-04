import classNames from "classnames"
import React, { CSSProperties, ReactElement, ReactNode } from "react"
import SharedIcon from "./SharedIcon"

type Props = {
  header: string
  icon?: string
  style?: CSSProperties
  children?: ReactNode
  type?: "normal" | "small"
}

export default function SharedSlideUpMenuPanel({
  header,
  icon,
  style,
  children,
  type = "normal",
}: Props): ReactElement {
  return (
    <div>
      <div
        className={classNames("header_wrap", {
          small: type === "small",
        })}
      >
        {icon && (
          <SharedIcon
            width={16}
            height={16}
            icon={icon}
            style={{ marginRight: 5 }}
            color="var(--white)"
          />
        )}
        <h3 style={style}>{header}</h3>
      </div>
      {children}
      <style jsx>{`
        h3 {
          margin: 0;
        }
        .header_wrap {
          position: sticky;
          margin-top: -6px;
          z-index: var(--z-base);

          display: flex;
          align-items: center;
          padding-left: 24px;
          padding-bottom: 16px;
        }
        .header_wrap.small h3 {
          font-size: 16px;
          line-height: 24px;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
