/* eslint-disable no-nested-ternary */
import React, { CSSProperties, ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { I18nKey } from "../../_locales/i18n"
import SharedIcon from "../Shared/SharedIcon"

const icons: Record<
  "close" | "expand" | "view",
  {
    icon: string
    label: I18nKey
    background: string
    backgroundHover?: string
    size: number
    style?: CSSProperties
  }
> = {
  close: {
    icon: "close",
    label: "nfts.collectionHover.close",
    background: "var(--green-40)",
    backgroundHover: "var(--green-20)",
    size: 12,
  },
  expand: {
    icon: "chevron",
    label: "nfts.collectionHover.expand",
    background: "var(--success)",
    size: 12,
    style: { marginBottom: 3 },
  },
  view: {
    icon: "eye",
    label: "nfts.collectionHover.view",
    background: "var(--trophy-gold)",
    size: 22,
  },
}

const getIconType = (isCollection: boolean, isExpanded: boolean) => {
  if (isCollection) {
    return isExpanded ? "close" : "expand"
  }
  return "view"
}

export default function NFTsHover(props: {
  isCollection?: boolean
  isExpanded?: boolean
  onClick: () => void
}): ReactElement {
  const { isCollection = false, isExpanded = false, onClick } = props
  const { t } = useTranslation()

  const iconType = getIconType(isCollection, isExpanded)

  const { icon, label, background, backgroundHover, size, style } =
    icons[iconType]

  return (
    <button
      type="button"
      className="nft_hover"
      data-testid={iconType}
      onClick={onClick}
    >
      <div>{t(label)}</div>
      <div className="nft_hover_icon">
        <SharedIcon
          icon={`${icon}@2x.png`}
          width={size}
          color="var(--hunter-green)"
          style={style}
        />
      </div>
      <style jsx>{`
        .nft_hover {
          opacity: ${isExpanded ? 1 : 0};
          position: absolute;
          top: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 20, 19, 0.75); // --green-120
          border-radius: 4px;
          backdrop-filter: blur(8px);
          font-size: 14px;
          font-weight: 500;
          line-height: 16px;
          letter-spacing: 3%;
          z-index: var(--z-base);
          transition: opacity 200ms ease-in-out;
        }
        .nft_hover:hover {
          opacity: 1;
        }
        .nft_hover_icon {
          margin-top: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${background};
          width: 32px;
          height: 32px;
          border-radius: 100%;
          transition: background 200ms ease-in-out;
        }
        .nft_hover:hover .nft_hover_icon {
          background: ${backgroundHover ?? background};
        }
      `}</style>
    </button>
  )
}
