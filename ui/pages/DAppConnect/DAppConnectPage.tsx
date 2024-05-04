import React, { ReactElement, useEffect, useState } from "react"
import { AccountTotal } from "@tallyho/tally-background/redux-slices/selectors"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import { useTranslation } from "react-i18next"
import { selectDefaultWallet } from "@tallyho/tally-background/redux-slices/ui"
import SharedButton from "../../components/Shared/SharedButton"
import SharedAccountItemSummary from "../../components/Shared/SharedAccountItemSummary"
import RequestingDAppBlock from "./RequestingDApp"
import { useBackgroundSelector } from "../../hooks"
import DAppConnectionInfoBar from "../../components/DAppConnection/DAppConnectionInfoBar"

type DAppConnectPageProps = {
  permission: PermissionRequest
  currentAccountTotal: AccountTotal
  denyPermission: () => Promise<void>
  grantPermission: () => Promise<void>
}

export default function DAppConnectPage({
  permission,
  currentAccountTotal,
  denyPermission,
  grantPermission,
}: DAppConnectPageProps): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "dappConnection" })
  const { title, origin, faviconUrl, accountAddress } = permission

  const isDefaultWallet = useBackgroundSelector(selectDefaultWallet)
  const [wasDefaultWallet, setWasDefaultWallet] = useState(isDefaultWallet)

  useEffect(() => {
    if (wasDefaultWallet && !isDefaultWallet) {
      // When default wallet is toggled off, wait for the toggle animation to
      // complete and close the window out.
      setTimeout(() => window.close(), 300)
    }
  }, [wasDefaultWallet, isDefaultWallet])

  useEffect(() => {
    if (!wasDefaultWallet && isDefaultWallet) {
      // When default wallet is toggled on, make sure wasDefaultWallet is
      // updated. This handles the situation where the wallet is not default,
      // then a connection popup appears, then the user toggles it to default,
      // then they toggle it back off---in that scenario, we want the same
      // behavior as if the popup had been set as default and then it was
      // turned off.
      setWasDefaultWallet(true)
    }
  }, [wasDefaultWallet, isDefaultWallet])

  return (
    <>
      <DAppConnectionInfoBar />
      <section className="standard_width">
        <h1 className="serif_header">{t("connectToDapp")}</h1>
        <div className="connection_destination">
          <RequestingDAppBlock
            title={title}
            url={origin}
            faviconUrl={faviconUrl}
          />
        </div>
        <div className="icon_connection" />
        <div className="connection_destination">
          <SharedAccountItemSummary
            key={accountAddress}
            accountTotal={currentAccountTotal}
          />
        </div>
        <ul className="permissions_list">
          <li className="permissions_list_title">
            {t("dappPermissionListTitle")}
          </li>
          <li>
            <ul>
              <li>{t("viewAddressPermission")}</li>
              <li>{t("createTransactionPermission")}</li>
            </ul>
          </li>
        </ul>
      </section>
      <div className="footer_actions">
        <SharedButton
          id="denyPermission"
          size="large"
          type="secondary"
          onClick={denyPermission}
        >
          {t("rejectConnection")}
        </SharedButton>
        <SharedButton
          id="grantPermission"
          type="primary"
          size="large"
          onClick={grantPermission}
        >
          {t("acceptConnection")}
        </SharedButton>
      </div>
      <style jsx>{`
        section {
          display: flex;
          flex-direction: column;
          height: 100vh;
          margin: 0 auto;
        }
        .page {
          background-color: var(--green-95);
          height: 100vh;
          width: 100vw;
          z-index: var(--z-over-menu);
        }
        h1 {
          color: var(--trophy-gold);
          margin-top: 45px;
          margin-bottom: 25px;
          text-align: center;
        }
        .permissions_list {
          margin-left: 16px;
        }
        ul {
          display: flex;
          flex-direction: column;
        }
        li {
          font-size: 14px;
          line-height: 20px;
          color: var(--green-40);
          margin-bottom: 4px;
          margin-left: 5px;
        }
        .permissions_list_title {
          color: #fff;
          margin-bottom: 8px;
          margin-top: 15px;
          margin-left: 0px;
        }
        .connection_destination {
          width: 100%;
          height: 88px;
          background-color: var(--hunter-green);
          border-radius: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
          box-sizing: border-box;
          margin-bottom: 8px;
        }
        .icon_connection {
          background: url("./images/bolt@2x.png") center no-repeat;
          background-color: var(--green-95);
          border-radius: 4px;
          background-size: 10px 17px;
          border: solid 3px var(--hunter-green);
          width: 24px;
          height: 24px;
          margin-left: 28px;
          margin-top: -19px;
          margin-bottom: -10px;
          z-index: var(--z-expnaded);
        }
        .footer_actions {
          position: fixed;
          bottom: 0px;
          display: flex;
          width: 100%;
          padding: 0px 16px;
          box-sizing: border-box;
          align-items: center;
          height: 80px;
          justify-content: space-between;
          box-shadow: 0 0 5px rgba(0, 20, 19, 0.5);
          background-color: var(--green-95);
        }
      `}</style>
    </>
  )
}
