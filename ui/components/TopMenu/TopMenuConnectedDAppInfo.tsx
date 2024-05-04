import { FeatureFlags, isEnabled } from "@tallyho/tally-background/features"
import classNames from "classnames"
import React, { ReactElement, useCallback, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import DAppConnectionDefaultToggle from "../DAppConnection/DAppConnectionDefaultToggle"
import SharedAccordion from "../Shared/SharedAccordion"
import SharedLink from "../Shared/SharedLink"
import SharedPanelSwitcher from "../Shared/SharedPanelSwitcher"
import SharedTooltip from "../Shared/SharedTooltip"

function ConnectionDAppGuideline({
  isConnected,
}: {
  isConnected: boolean
}): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "topMenu.connectedDappInfo",
  })
  const showWalletConnectInfo = isEnabled(FeatureFlags.SUPPORT_WALLET_CONNECT)
  const { t: tShared } = useTranslation("translation", { keyPrefix: "shared" })
  const [currentPanel, setCurrentPanel] = useState(
    showWalletConnectInfo ? 0 : 1,
  )

  return (
    <>
      <SharedAccordion
        contentHeight={showWalletConnectInfo ? 298 : 242}
        style={{
          width: 320,
          borderRadius: 8,
          marginTop: 8,
          background: "var(--green-120)",
          "--panel-switcher-border": "var(--green-80)",
          "--header-padding": "16px",
          "--content-fade-in-duration": "200ms",
        }}
        isInitiallyOpen={!isConnected}
        headerElement={<div className="title">{t("guideline.title")}</div>}
        contentElement={
          <div className="content_wrap">
            {showWalletConnectInfo && (
              <SharedPanelSwitcher
                panelNames={["Wallet Connect", "Injected Wallet"]}
                panelNumber={currentPanel}
                setPanelNumber={setCurrentPanel}
              />
            )}
            <div className="panel_wrap">
              {currentPanel === 0 && (
                // Wallet connect guidelines
                <div className="wallet_connect_info">
                  <div className="learn_more">
                    <img
                      height="52"
                      alt="Taho - Wallet Connect"
                      src="/images/tally_wc.png"
                    />
                    <p>
                      <Trans
                        t={t}
                        i18nKey="walletConnectInfo"
                        components={{
                          url: <SharedLink url="#" />,
                        }}
                      />
                    </p>
                  </div>
                  <img
                    width="100%"
                    alt={t("walletConnectHint")}
                    src="/images/wallet_connect_guideline.png"
                  />
                </div>
              )}

              {currentPanel === 1 && (
                // Injected wallet guidelines
                <>
                  <ol className="steps">
                    <li>
                      <span className="wallet_toggle_wrap">
                        {t("guideline.step1")}
                        <DAppConnectionDefaultToggle alwaysForceSelection="taho" />
                      </span>
                    </li>
                    <li>{t("guideline.step2")}</li>
                    <li>{t("guideline.step3")}</li>
                  </ol>
                  <div className="list_wrap">
                    <span className="item">
                      <img src="./images/tally_token.svg" alt="Taho token" />
                      {tShared("taho")}
                    </span>
                    <span className="item">
                      <img
                        src="./images/icons/s/arrow-right.svg"
                        alt="Arrow right"
                      />
                      {tShared("injected")}
                    </span>
                    <span className="item">
                      <span className="fox">🦊</span> {tShared("metaMask")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />
      <style jsx>{`
        .title {
          font-weight: 600;
          font-size: 18px;
          line-height: 24px;
        }
        .content_wrap {
          height: 85%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .panel_wrap {
          padding: ${showWalletConnectInfo ? "16px" : "0 16px 16px"};
        }
        .wallet_connect_info p {
          margin: 0;
          font-size: 16px;
          color: var(--green-40);
          font-family: Segment;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0em;
        }
        .wallet_connect_info .learn_more {
          display: flex;
          gap: 16px;
        }

        .wallet_toggle_wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .steps {
          margin: 0;
          padding: 0;
          display: flex;
          flex-flow: column;
          list-style: none;
          counter-reset: step;
          color: var(--green-40);
        }
        .steps > li {
          display: flex;
          align-items: start;
          font-weight: 500;
          font-size: 16px;
          line-height: 40px;
        }
        .steps > li::before {
          content: counter(step) ".";
          counter-increment: step;
          padding-right: 4px;
        }
        .list_wrap {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .item img {
          width: 16px;
        }
        .fox {
          font-size: 12px;
        }
        .item {
          font-weight: 500;
          line-height: 24px;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .item:after {
          content: "/";
          color: var(--green-60);
        }
        .item:last-child:after {
          display: none;
        }
      `}</style>
    </>
  )
}

export default function TopMenuConnectedDAppInfo(props: {
  title: string
  url: string
  faviconUrl: string
  isConnected: boolean
  close: () => void
  disconnect: () => void
}): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "topMenu.connectedDappInfo",
  })
  const { t: tShared } = useTranslation("translation", { keyPrefix: "shared" })
  const { title, url, close, faviconUrl, disconnect, isConnected } = props

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
      <div className="window">
        <button
          type="button"
          className="icon_close"
          aria-label={tShared("close")}
          onClick={animateThenClose}
        />
        <div className="content">
          <h1>{t(`${isConnected ? "dAppTitle" : "dappConnections"}`)}</h1>
          <div
            className={classNames("dAppInfo_wrap", {
              visible: isConnected,
            })}
          >
            <div className="favicon" />
            <div className="title text ellipsis" title={title}>
              {title}
            </div>
            <div className="url text ellipsis" title={url}>
              {url}
            </div>
            <SharedTooltip
              width={120}
              verticalPosition="bottom"
              horizontalPosition="center"
              verticalShift={-20}
              type="dark"
              IconComponent={() => (
                <button
                  aria-label="disconnect"
                  type="button"
                  className="disconnect_icon"
                  onClick={disconnect}
                />
              )}
            >
              {t("disconnectDapp")}
            </SharedTooltip>
          </div>
        </div>
        <ConnectionDAppGuideline isConnected={isConnected} />
      </div>
      <button
        aria-label={tShared("modalClose")}
        type="button"
        className="void_space"
        onClick={animateThenClose}
      />
      <style jsx>{`
        .bg {
          width: 100%;
          height: 100%;
          border-radius: 16px;
          background-color: rgba(0, 37, 34, 0.71);
          position: fixed;
          z-index: var(--z-99999);
          top: 55px;
          left: 0px;
        }
        .window {
          width: 352px;
          max-height: 90%;
          box-shadow:
            0 10px 12px rgba(0, 20, 19, 0.34),
            0 14px 16px rgba(0, 20, 19, 0.24),
            0 24px 24px rgba(0, 20, 19, 0.14);
          border-radius: 8px;
          background-color: var(--green-95);
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0 auto;
          justify-content: space-between;
          padding-bottom: 16px;
        }
        .content {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .icon_close {
          mask-image: url("./images/close.svg");
          mask-size: cover;
          width: 12px;
          height: 12px;
          position: absolute;
          right: 33px;
          background-color: var(--green-20);
          z-index: var(--z-base);
          margin-top: 17px;
        }
        .void_space {
          height: 100%;
          width: 100%;
          position: fixed;
          top: 0;
          left: 0;
          z-index: var(--z-backdrop);
        }
        h1 {
          color: var(--${isConnected ? "success" : "green-20"});
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          text-align: center;
        }
        .favicon {
          background: url("${faviconUrl === ""
            ? "./images/dapp_favicon_default@2x.png"
            : faviconUrl}");
          background-size: cover;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .title {
          color: #fff;
          font-weight: 500;
          margin-top: 10px;
        }
        .url {
          color: var(--green-40);
          margin-top: 5px;
        }
        .text {
          font-size: 16px;
          width: calc(100% - 16px);
          padding: 0 8px;
          text-align: center;
        }
        .disconnect_icon {
          background: url("./images/disconnect@2x.png");
          background-size: cover;
          width: 16px;
          height: 18px;
          margin: 16px 0 40px;
        }
        .dAppInfo_wrap {
          width: 100%;
          display: flex;
          flex-flow: column;
          align-items: center;
          max-height: 0;
          overflow: hidden;
          transition: max-height 250ms ease-out;
        }
        .dAppInfo_wrap.visible {
          max-height: 200px;
          transition: max-height 250ms ease-in;
        }
      `}</style>
    </div>
  )
}
