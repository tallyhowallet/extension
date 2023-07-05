import { FeatureFlags, isEnabled } from "@tallyho/tally-background/features"
import { EVMNetwork } from "@tallyho/tally-background/networks"
import { removeCustomChain } from "@tallyho/tally-background/redux-slices/networks"
import { selectCustomNetworks } from "@tallyho/tally-background/redux-slices/selectors/networks"
import React, { ReactElement, useState } from "react"
import { browser } from "@tallyho/tally-background"
import { Trans, useTranslation } from "react-i18next"
import SharedButton from "../../components/Shared/SharedButton"
import SharedIcon from "../../components/Shared/SharedIcon"
import SharedLink from "../../components/Shared/SharedLink"
import SharedNetworkIcon from "../../components/Shared/SharedNetworkIcon"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import SharedSlideUpMenu from "../../components/Shared/SharedSlideUpMenu"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { intersperseWith } from "../../utils/lists"
import { ADD_CUSTOM_NETWORK } from "../Onboarding/Tabbed/Routes"
import { CHAIN_LIST } from "../../utils/constants"

export default function SettingsCustomNetworks(): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "settings.customNetworksSettings",
  })
  const { t: sharedT } = useTranslation("translation")

  const dispatch = useBackgroundDispatch()

  const allCustomNetworks = useBackgroundSelector(selectCustomNetworks)

  const customNetworksListItems = intersperseWith(
    allCustomNetworks,
    () => "spacer" as const
  )

  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [networkToDelete, setNetworkToDelete] = useState<EVMNetwork | null>(
    null
  )

  const handleModalConfirm = () => {
    if (networkToDelete) {
      dispatch(removeCustomChain(networkToDelete.chainID))
      setShowConfirmDelete(false)
      setNetworkToDelete(null)
    }
  }

  const handleModalCancel = () => {
    setShowConfirmDelete(false)
    setNetworkToDelete(null)
  }

  return (
    <div className="standard_width_padded wrapper">
      <SharedSlideUpMenu
        isOpen={showConfirmDelete}
        close={() => handleModalCancel()}
        size="custom"
        customSize="228px"
      >
        <div className="confirm_menu">
          <h3>{t("deleteModal.title")}</h3>
          <p className="confirm_menu_description">
            <Trans
              t={t}
              i18nKey="deleteModal.desc"
              components={{
                name: (
                  <span
                    title={networkToDelete?.name}
                    className="confirm_menu_network_name"
                  />
                ),
              }}
              values={{ name: networkToDelete?.name }}
            />
          </p>
          <div className="confirm_menu_actions">
            <SharedButton
              size="medium"
              type="secondary"
              onClick={handleModalCancel}
            >
              {sharedT("shared.cancelBtn")}
            </SharedButton>
            <SharedButton
              size="medium"
              type="primary"
              onClick={handleModalConfirm}
            >
              {t("deleteModal.confirm")}
            </SharedButton>
          </div>
        </div>
      </SharedSlideUpMenu>
      <style jsx>{`
        .confirm_menu {
          padding: 0 26px 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          height: 100%;
          box-sizing: border-box;
        }

        .confirm_menu h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          line-height: 24px;
          letter-spacing: 0em;
        }

        .confirm_menu_description {
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: left;
          margin: 0;
          color: var(--green-40);
          flex-grow: 1;
        }
        .confirm_menu_actions {
          display: flex;
          justify-content: space-between;
          margin-top: -20px;
          flex-shrink: 0;
        }

        .confirm_menu_network_name {
          color: var(--white);
        }
      `}</style>
      <SharedPageHeader withoutBackText>{t(`title`)}</SharedPageHeader>
      {customNetworksListItems.length > 0 && (
        <section className="content">
          <h2 className="subheader">{t("subtitleAdded")}</h2>
          <ul className="custom_networks_list">
            {customNetworksListItems.map((item, index) => {
              if (item === "spacer") {
                return (
                  <li
                    role="presentation"
                    key={`spacer-${index.toString()}`}
                    className="spacer"
                  />
                )
              }

              return (
                <li className="custom_network_item" key={item.chainID}>
                  <SharedNetworkIcon size={42} network={item} />
                  <div className="network_label">
                    <span className="network_name" title={item.name}>
                      {item.name}
                    </span>
                    <span className="network_type">
                      {t("networksList.typeCustom")}
                    </span>
                  </div>
                  <div className="actions">
                    <SharedIcon
                      width={16}
                      onClick={() => {
                        setShowConfirmDelete(true)
                        setNetworkToDelete(item)
                      }}
                      icon="icons/s/garbage.svg"
                      color="var(--green-40)"
                      hoverColor="var(--error)"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <section className="content">
        <h2 className="subheader">{t("subtitleAddMore")}</h2>
        <div className="chain_add_options">
          <div className="chain_list_wrap">
            <div className="icon" />
            <span className="simple_text">
              <Trans
                t={t}
                i18nKey="chainList.description"
                components={{
                  url: (
                    <SharedLink text={CHAIN_LIST.name} url={CHAIN_LIST.url} />
                  ),
                }}
              />
            </span>
            <div>
              <SharedButton
                type="primary"
                size="medium"
                iconSmall="new-tab"
                style={{ marginTop: "24px" }}
                onClick={() => window.open(CHAIN_LIST.url, "_blank")?.focus()}
              >
                {t(`chainList.addBtn`)}
              </SharedButton>
            </div>
          </div>
          <hr className="separator" />
          {isEnabled(FeatureFlags.SUPPORT_CUSTOM_RPCS) && (
            <div className="custom_rpc_wrap">
              <span className="simple_text">{t(`customRPC.description`)}</span>
              <SharedButton
                type="tertiary"
                size="medium"
                iconSmall="new-tab"
                onClick={() =>
                  window.open(browser.runtime.getURL(ADD_CUSTOM_NETWORK))
                }
              >
                {t(`customRPC.addBtn`)}
              </SharedButton>
            </div>
          )}
        </div>
      </section>
      <style jsx>{`
        .wrapper {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .spacer {
          width: 100%;
          border: 0.5px solid var(--green-120);
        }
        .subheader {
          font-family: Segment;
          font-size: 18px;
          font-weight: 600;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: left;
          color: var(--green-20);
          margin: 0;
        }

        .custom_networks_list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .custom_network_item .actions {
          margin-left: auto;
        }
        .custom_network_item {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .network_label {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .network_name {
          font-family: Segment;
          font-size: 18px;
          font-weight: 600;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--white);
          overflow-x: hidden;
          text-overflow: ellipsis;
          white-space: pre;
          max-width: 200px;
        }
        .network_type {
          font-family: Segment;
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--green-40);
        }

        .content {
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chain_list_wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chain_add_options {
          gap: 32px;
        }

        .separator {
          border: none;
          border-top: 1px solid var(--green-95);
          margin: 32px 0;
        }

        .icon {
          background: url("./images/chain_list.svg") center no-repeat;
          width: 132px;
          height: 32px;
        }
        .custom_rpc_wrap {
          padding-bottom: 32px;
        }
      `}</style>
    </div>
  )
}
