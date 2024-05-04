import React, { useEffect, useState } from "react"
import {
  addNetworkUserResponse,
  getAddNetworkRequestDetails,
} from "@tallyho/tally-background/redux-slices/ui"
import { AddChainRequestData } from "@tallyho/tally-background/services/provider-bridge"
import { useTranslation } from "react-i18next"
import { selectEVMNetworks } from "@tallyho/tally-background/redux-slices/selectors/networks"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks"
import SharedButton from "../components/Shared/SharedButton"
import SharedIcon from "../components/Shared/SharedIcon"
import SharedNetworkIcon from "../components/Shared/SharedNetworkIcon"

export default function NewCustomNetworkRequest(): JSX.Element | null {
  const parsedQueryString = new URLSearchParams(window.location.search)
  const { requestId } = Object.fromEntries(parsedQueryString.entries())

  const [networkDetails, setNetworkDetails] =
    useState<AddChainRequestData | null>(null)

  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()

  useEffect(() => {
    dispatch(getAddNetworkRequestDetails(requestId)).then((chainDetails) =>
      setNetworkDetails(chainDetails as unknown as AddChainRequestData),
    )
  }, [dispatch, requestId])

  const allNetworks = useBackgroundSelector(selectEVMNetworks)

  if (!networkDetails) {
    return null
  }

  const existingNetwork = allNetworks.find(
    (network) => network.chainID === networkDetails.chainId,
  )

  const {
    chainId: chainID,
    chainName,
    nativeCurrency,
    iconUrl,
    rpcUrls,
    blockExplorerUrl,
    favicon,
    siteTitle,
  } = networkDetails

  function handleUserResponse(success: boolean): void {
    dispatch(addNetworkUserResponse([requestId, success])).then(() =>
      window.close(),
    )
  }

  return (
    <div className="standard_width">
      <style jsx>{`
        // Hacky, but allows us to override the parent popup container styles
        :global(main) {
          background-color: var(--green-95) !important;
        }
      `}</style>
      <form
        action="#"
        onSubmit={(e) => {
          e.preventDefault()
          handleUserResponse(true)
        }}
      >
        <header>
          <h1>
            <img
              style={{ objectFit: "contain", objectPosition: "center" }}
              height={24}
              width={24}
              alt={siteTitle}
              src={favicon}
            />
            {siteTitle}
          </h1>
          <p>{t("addNewChain.subtitle")}</p>
        </header>
        <div className="details_container">
          <div className="add_chain_imgs">
            <div className="new_chain_logo_wrapper">
              {iconUrl ? (
                <div className="new_chain_logo" />
              ) : (
                <SharedNetworkIcon
                  size={50}
                  network={
                    existingNetwork || {
                      name: chainName,
                      chainID,
                      family: "EVM",
                      baseAsset: { ...nativeCurrency, chainID },
                    }
                  }
                />
              )}
            </div>
            <div className="plus_wrapper">
              <SharedIcon
                width={14}
                height={14}
                color="var(--trophy-gold)"
                style={{ margin: 2 }}
                icon="plus@2x.png"
              />
            </div>
            <div className="tally_logo" />
          </div>
          <dl className="chain_details">
            {existingNetwork ? (
              <div className="network_exists_warning">
                <p>{t("addNewChain.warnAlreadyExistsHeader")}</p>
                <span>{t("addNewChain.warnAlreadyExistsBody")}</span>
              </div>
            ) : (
              <div className="chain_info">
                <div className="row">
                  <dt>{t("addNewChain.name")}</dt>
                  <dd>{chainName}</dd>
                </div>
                <div className="row">
                  <dt>{t("addNewChain.chainId")}</dt>
                  <dd>{chainID}</dd>
                </div>
                <div className="row">
                  <dt>{t("addNewChain.currency")}</dt>
                  <dd>{nativeCurrency.symbol}</dd>
                </div>
                <dt>{t("addNewChain.rpc")}</dt>
                <dd className="rpc_url">{rpcUrls[0]}</dd>
                <dt>{t("addNewChain.explorer")}</dt>
                <dd>{blockExplorerUrl}</dd>
              </div>
            )}
          </dl>
        </div>
        <footer>
          {existingNetwork ? (
            <div className="center_horizontal">
              <SharedButton size="large" type="primary" isFormSubmit>
                {t("shared.close")}
              </SharedButton>
            </div>
          ) : (
            <>
              <SharedButton
                size="large"
                type="secondary"
                onClick={() => handleUserResponse(false)}
              >
                {t("addNewChain.cancel")}
              </SharedButton>
              <SharedButton
                id="addNewChain"
                size="large"
                type="primary"
                isFormSubmit
              >
                {t("addNewChain.submit")}
              </SharedButton>
            </>
          )}
        </footer>
      </form>
      <style jsx>{`
        .network_exists_warning {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .network_exists_warning span {
          font-family: Segment;
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          display: block;
          color: var(--green-40);
        }

        .network_exists_warning p {
          font-family: Segment;
          font-size: 22px;
          font-weight: 500;
          line-height: 32px;
          letter-spacing: 0em;
          text-align: center;
          margin: 0;
        }

        .add_chain_imgs {
          display: flex;
          justify-content: center;
          align-items: center;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--castle-black);
          max-width: calc(100% - 44px);
          margin: 0 auto;
        }

        .new_chain_logo_wrapper {
          width: 50px;
          height: 50px;
          border-radius: 8px;
          overflow: hidden;
        }

        .new_chain_logo {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          background: url("${iconUrl}") center / contain no-repeat;
        }

        .tally_logo {
          background: url("./images/doggo_gold.svg") center / 65px no-repeat;
          height: 56px;
          width: 56px;
          border-radius: 16px;
        }

        .plus_wrapper {
          align-self: center;
          position: relative;
          border: 4px solid var(--hunter-green);
          border-radius: 50%;
          background-color: var(--green-95);
          padding: 4px;
          margin-right: -4px;
          margin-left: -4px;
          z-index: var(--z-base);
        }

        form {
          padding-top: 20px;
        }

        header {
          margin: 14px 0 34px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        header h1 {
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Segment;
          font-size: 18px;
          font-weight: 600;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          gap: 6px;
        }
        header p {
          font-family: Segment;
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          margin: 0;
        }

        .details_container {
          background: var(--hunter-green);
          border-radius: 16px;
          padding: 24px 0;
          margin-bottom: 16px;
        }

        .chain_details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 24px 0 0;
        }

        .chain_info {
          padding: 0 24px;
        }

        .row {
          display: flex;
          justify-content: space-between;
        }

        dt,
        dd {
          margin: 0;
        }

        dt {
          color: var(--green-40);
          font-family: Segment;
          font-size: 14px;
          font-weight: 500;
          line-height: 16px;
          letter-spacing: 0.03em;
          text-align: left;
        }

        dd {
          color: var(--white);
          font-family: Segment;
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: left;
        }

        .row dd {
          text-align: right;
        }

        .rpc_url {
          word-break: break-all;
        }

        footer {
          padding-top: 16px;
          display: flex;
          justify-content: space-between;
        }
      `}</style>
    </div>
  )
}
