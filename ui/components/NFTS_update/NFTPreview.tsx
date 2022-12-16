import { FeatureFlags, isEnabled } from "@tallyho/tally-background/features"
import { truncateAddress } from "@tallyho/tally-background/lib/utils"
import { NFTWithCollection } from "@tallyho/tally-background/redux-slices/nfts_update"
import React, { ReactElement, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useIntersectionObserver } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import SharedNetworkIcon from "../Shared/SharedNetworkIcon"
import ExploreMarketLink, { getRelevantMarketsList } from "./ExploreMarketLink"
import NFTImage from "./NFTImage"

const MAX_DESCRIPTION_LENGTH = 180
const LINK_REGEX = /\[([\w\s\d]+)\]\((https?:\/\/[\w\d./?=#]+)\)/gm

const removeMarkdownLinks = (description: string) => {
  return description.replace(LINK_REGEX, "$1")
}

const trimDescription = (description: string) =>
  description && description.length > MAX_DESCRIPTION_LENGTH
    ? `${description.slice(0, MAX_DESCRIPTION_LENGTH)}...`
    : description

const parseDescription = (description = "") => {
  return trimDescription(removeMarkdownLinks(description))
}

export default function NFTPreview(props: NFTWithCollection): ReactElement {
  const { nft, collection } = props
  const {
    thumbnailURL,
    contract,
    name,
    network,
    owner,
    description,
    attributes,
    isBadge,
  } = nft
  const { totalNftCount } = collection
  const floorPrice =
    "floorPrice" in collection &&
    collection.floorPrice?.value &&
    collection.floorPrice

  // Chrome seems to have problems when elements with backdrop style are rendered initially
  // out of the viewport - browser is not rendering them at all. This is a workaround
  // to force them to rerender.
  // TODO: scrolling in and out of the view is still breaking it, needs more work
  const backdropCallback = useCallback(([div]) => {
    if (div.isIntersecting) {
      div.target.classList.remove("preview_backdrop")
      div.target.classList.add("preview_backdrop")
    }
  }, [])
  const backdropRef = useIntersectionObserver<HTMLDivElement>(
    backdropCallback,
    { threshold: 0.8 }
  )

  const marketsList = useMemo(() => getRelevantMarketsList(nft), [nft])
  const { t } = useTranslation("translation", {
    keyPrefix: "nfts",
  })

  return (
    <>
      <div className="preview_wrapper">
        <div className="preview_image">
          <NFTImage
            src={thumbnailURL}
            alt={name}
            width={384}
            isBadge={isBadge}
            customStyles="border-radius: 0 0 8px 8px;"
          />
          <div className="preview_network">
            <SharedNetworkIcon network={network} size={24} hasBackground />
          </div>
          <div className="preview_details" ref={backdropRef}>
            <div className="preview_section_column">
              <span className="preview_details_header">
                {t("preview.owner")}
              </span>
              <span className="preview_details_value">
                {truncateAddress(owner)}
              </span>
            </div>
            <div className="preview_section_column align_right">
              <span className="preview_details_header">
                {t("preview.floorPrice")}
              </span>
              <span className="preview_details_value">
                {floorPrice
                  ? `~${floorPrice.value} ${floorPrice.tokenSymbol}`
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="preview_header">
          <h1 className="ellipsis_multiline">
            {name?.length ? name : "No title"}
          </h1>
          {isEnabled(FeatureFlags.SUPPORT_NFT_SEND) && (
            <SharedButton
              type="tertiary"
              size="small"
              iconSmall="send"
              iconPosition="left"
            >
              {t("preview.send")}
            </SharedButton>
          )}
        </div>

        <div className="preview_section">
          <div className="preview_section_header"> {t("preview.viewOn")}</div>
          <div className="preview_section_row preview_markets">
            {marketsList.map(
              ({
                url,
                title,
                color,
                icon,
                hoverIcon,
                hoverColor,
                getNFTLink,
              }) => (
                <ExploreMarketLink
                  type="button"
                  key={url}
                  url={getNFTLink(nft)}
                  {...{ title, color, icon, hoverColor, hoverIcon }}
                />
              )
            )}
          </div>
        </div>

        <div className="preview_section">
          <div className="preview_section_header">
            {t("preview.description")}
          </div>
          <p>{parseDescription(description) || "-"}</p>
        </div>

        <div className="preview_section preview_section_row">
          <div className="preview_section_column">
            <div className="preview_section_header">
              {t("preview.itemsCount")}
            </div>
            <p>{totalNftCount ?? "-"}</p>
          </div>
          <div className="preview_section_column align_right">
            <div className="preview_section_header">{t("preview.creator")}</div>
            <p>
              {contract?.startsWith("0x") ? truncateAddress(contract) : "-"}
            </p>
          </div>
        </div>

        {!!attributes.length && (
          <div className="preview_section">
            <div className="preview_section_header">
              {t("preview.properties")}
            </div>
            <div className="preview_property_list preview_section_row">
              {attributes.map(
                ({ trait, value }) =>
                  !!value && (
                    <div
                      key={trait}
                      className="preview_property preview_section_column"
                    >
                      <span className="preview_property_trait">{trait}</span>
                      <span
                        className="preview_property_value ellipsis"
                        title={value}
                      >
                        {value}
                      </span>
                    </div>
                  )
              )}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes progressive-blur {
          0% {
            backdrop-filter: blur(1px);
          }
          100% {
            backdrop-filter: blur(4px);
          }
        }
        .preview_wrapper {
          height: 100%;
          width: 100%;
          overflow: auto;
        }
        .preview_image {
          position: relative;
        }
        .preview_network {
          position: absolute;
          top: 16px;
          left: 16px;
        }
        .preview_details {
          position: absolute;
          bottom: 14px;
          display: flex;
          margin: 0 16px;
          padding: 4px 8px;
          width: calc(100% - 48px);
          justify-content: space-between;
          background: rgba(0, 20, 19, 0.75); // --green-120
          border-radius: 8px;
        }
        .preview_backdrop {
          animation: progressive-blur 120ms ease-in forwards;
        }
        .preview_details_header {
          font-weight: 500;
          font-size: 12px;
          line-height: 16px;
        }
        .preview_details_value {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
        }
        .preview_header {
          display: flex;
          justify-content: space-between;
          margin: 20px 24px;
        }
        .preview_header h1 {
          margin: 0;
          font-size: 22px;
          line-height: 32px;
          font-weight: 500;
        }
        .preview_section {
          margin: 0 24px 24px;
        }
        .preview_section p {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          color: var(--green-20);
          margin: 0;
        }
        .preview_section_column {
          display: flex;
          flex-direction: column;
        }
        .preview_section_row {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
        }
        .preview_section_column.align_right {
          text-align: right;
        }
        .preview_section_header {
          font-weight: 500;
          font-size: 14px;
          line-height: 16px;
          color: var(--green-40);
          margin-bottom: 4px;
        }
        .preview_property {
          box-sizing: border-box;
          background: var(--green-120);
          width: 160px;
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 16px;
          justify-content: center;
          align-items: center;
          line-height: 16px;
          font-weight: 500;
        }
        .preview_property_list {
          flex-wrap: wrap;
          margin: 8px -4px 0;
        }
        .preview_property_trait {
          color: var(--green-40);
          font-size: 12px;
          width: 100%;
          text-align: center;
        }
        .preview_property_value {
          font-size: 14px;
          width: 100%;
          text-align: center;
        }
        .preview_markets {
          margin-top: 8px;
          gap: 16px;
          justify-content: flex-start;
        }
      `}</style>
    </>
  )
}
