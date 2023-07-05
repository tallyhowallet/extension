import React, { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { EVMNetwork } from "@tallyho/tally-background/networks"
import { addCustomChain } from "@tallyho/tally-background/redux-slices/networks"
import { AsyncThunkFulfillmentType } from "@tallyho/tally-background/redux-slices/utils"
import { validateAddEthereumChainParameter } from "@tallyho/tally-background/services/provider-bridge/utils"
import { CHAIN_LIST } from "../utils/constants"
import SharedLink from "../components/Shared/SharedLink"
import SharedInput from "../components/Shared/SharedInput"
import SharedToggleButton from "../components/Shared/SharedToggleButton"
import SharedButton from "../components/Shared/SharedButton"
import SharedNetworkIcon from "../components/Shared/SharedNetworkIcon"
import { useSetState } from "../hooks/react-hooks"
import { useBackgroundDispatch } from "../hooks"

function isValidUrl(urlLike: string) {
  let url: URL

  try {
    url = new URL(urlLike)
  } catch (_) {
    return false
  }

  return url.protocol === "http:" || url.protocol === "https:"
}

function NewCustomNetworkSuccess({ network }: { network: EVMNetwork }) {
  const { t } = useTranslation("translation", {
    keyPrefix: "customNetworksTab.success",
  })

  return (
    <section>
      <div className="bg">
        <div className="fadeIn">
          <header>
            <img
              width="80"
              height="80"
              alt="Taho Gold"
              src="./images/doggo_gold.svg"
            />
            <h1 className="title">{t("title")}</h1>
            <p className="subtitle">{t("subtitle")}</p>
          </header>
          <div className="custom_network_preview">
            <SharedNetworkIcon size={42} network={network} />
            <div className="right">
              {/* TODO: Handle long strings */}
              <span className="name">{network.name}</span>
              <span className="description">custom network</span>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .custom_network_preview .right {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .custom_network_preview .name {
          font-size: 18px;
          font-weight: 600;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--white);
        }
        .custom_network_preview .description {
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;

          color: var(--green-40);
        }
        .custom_network_preview {
          display: flex;
          gap: 12px;
          margin: 0 auto;
          justify-content: center;
        }
        section {
          width: 100%;
          display: flex;
          height: 100%;
          width: 100%;
          justify-content: center;
        }

        .bg {
          position: relative;
          padding: 62px 80px 0;
          width: 50%;
          height: 100%;
          box-sizing: border-box;
          background: #04141480;
          overflow-y: hidden;
        }

        header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
        }

        .title {
          margin: 0;
          font-family: Quincy CF;
          font-size: 36px;
          font-weight: 500;
          line-height: 42px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--white);
        }

        .subtitle {
          margin: 0;
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--green-40);
        }
      `}</style>
    </section>
  )
}

export default function NewCustomNetworkTab(): JSX.Element {
  const { t } = useTranslation("translation", {
    keyPrefix: "customNetworksTab.form",
  })
  const { t: sharedT } = useTranslation("translation", {
    keyPrefix: "shared",
  })

  const dispatch = useBackgroundDispatch()

  const [formData, setFormData] = useSetState({
    networkName: "",
    rpc: "",
    chainID: "",
    symbol: "",
    blockExplorer: "",
    logoURL: "",
    isTestnet: false,
  })

  type ValidatedKeys = keyof Pick<
    typeof formData,
    "blockExplorer" | "logoURL" | "rpc"
  >

  const [formErrors, setFormErrors] = useSetState<
    Record<ValidatedKeys, boolean>
  >({
    rpc: false,
    blockExplorer: false,
    logoURL: false,
  })

  const [addedNetwork, setAddedNetwork] = useState<EVMNetwork | null>(null)

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault()
    const { symbol, networkName, rpc, chainID, blockExplorer, logoURL } =
      formData

    const network = (await dispatch(
      addCustomChain([
        validateAddEthereumChainParameter({
          chainName: networkName,
          rpcUrls: [rpc],
          chainId: chainID,
          blockExplorerUrls: blockExplorer ? [blockExplorer] : [],
          iconUrls: logoURL ? [logoURL] : [],
          nativeCurrency: { name: symbol, symbol, decimals: 18 },
        }),
      ])
    )) as unknown as AsyncThunkFulfillmentType<typeof addCustomChain>

    setAddedNetwork(network)
  }

  if (addedNetwork) {
    return <NewCustomNetworkSuccess network={addedNetwork} />
  }

  const validateURLValue = (
    value: string,
    field: ValidatedKeys
  ): { parsed: string } | { error: string } => {
    if (isValidUrl(value)) {
      setFormErrors({ ...formErrors, [field]: false })
      return { parsed: value }
    }

    setFormErrors({ ...formErrors, [field]: true })

    return { error: sharedT("invalidValue") }
  }

  const hasInvalidValues =
    formData.networkName.length < 1 ||
    formData.rpc.length < 1 ||
    formData.chainID.length < 1 ||
    formData.symbol.length < 1 ||
    formErrors.blockExplorer ||
    formErrors.logoURL ||
    formErrors.rpc

  return (
    <section>
      <div className="bg">
        <div className="fadeIn">
          <header>
            <img
              width="80"
              height="80"
              alt="Taho Gold"
              src="./images/doggo_gold.svg"
            />
            <h1 className="title">{t("title")}</h1>
            <p className="subtitle">
              <Trans
                t={t}
                i18nKey="subtitle"
                components={{
                  url: (
                    <SharedLink text={CHAIN_LIST.name} url={CHAIN_LIST.url} />
                  ),
                }}
              />
            </p>
          </header>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <SharedInput
                label={t("input.networkName")}
                onChange={(value) => setFormData({ networkName: value })}
              />
            </div>
            <div className="row">
              <SharedInput
                label={t("input.rpc")}
                parseAndValidate={(value) => validateURLValue(value, "rpc")}
                onChange={(value) => setFormData({ rpc: value })}
              />
            </div>
            <div className="row">
              <SharedInput
                label={t("input.chainID")}
                type="number"
                onChange={(value) => setFormData({ chainID: value })}
              />
            </div>
            <div className="row">
              <SharedInput
                label={t("input.symbol")}
                onChange={(value) => setFormData({ symbol: value })}
              />
            </div>
            <div className="row">
              <SharedInput
                label={t("input.blockExplorer")}
                onChange={(value) => setFormData({ blockExplorer: value })}
                parseAndValidate={(value) =>
                  validateURLValue(value, "blockExplorer")
                }
              />
            </div>
            <div className="row">
              <SharedInput
                label={t("input.logoURL")}
                onChange={(value) => setFormData({ logoURL: value })}
                parseAndValidate={(value) => validateURLValue(value, "logoURL")}
              />
            </div>
            <div className="row testnet_toggler">
              {t("input.isTestnet")}
              <SharedToggleButton
                onChange={(checked) => setFormData({ isTestnet: checked })}
              />
            </div>
            <div>
              <SharedButton
                style={{ width: "100%", boxSizing: "border-box" }}
                size="medium"
                type="primary"
                isDisabled={hasInvalidValues}
                center
                isFormSubmit
              >
                {t("submit")}
              </SharedButton>
            </div>
          </form>
        </div>
      </div>
      <style jsx>{`
        section {
          width: 100%;
          display: flex;
          height: 100%;
          width: 100%;
          justify-content: center;
        }

        .bg {
          position: relative;
          padding: 62px 80px 0;
          width: 50%;
          height: 100%;
          box-sizing: border-box;
          background: #04141480;
          overflow-y: hidden;
        }

        header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
        }

        .title {
          margin: 0;
          font-family: Quincy CF;
          font-size: 36px;
          font-weight: 500;
          line-height: 42px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--white);
        }

        .subtitle {
          margin: 0;
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          letter-spacing: 0em;
          text-align: center;
          color: var(--green-40);
        }

        form {
          all: unset;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 324px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .testnet_toggler {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0.03em;
          color: var(--white);
        }
      `}</style>
    </section>
  )
}
