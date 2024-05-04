import {
  ERC20_FUNCTIONS,
  ERC20_INTERFACE,
} from "@tallyho/tally-background/lib/erc20"
import {
  convertFixedPointNumber,
  fixedPointNumberToString,
  parseToFixedPointNumber,
} from "@tallyho/tally-background/lib/fixed-point"
import { isMaxUint256 } from "@tallyho/tally-background/lib/utils"
import { updateTransactionData } from "@tallyho/tally-background/redux-slices/transaction-construction"
import { AssetApproval } from "@tallyho/tally-background/services/enrichment"
import { ethers } from "ethers"
import { hexlify } from "ethers/lib/utils"
import React, { ReactElement, useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import classNames from "classnames"
import { Trans, useTranslation } from "react-i18next"
import { updateAdditionalSigningStatus } from "@tallyho/tally-background/redux-slices/signing"
import SharedAssetIcon from "../../../../Shared/SharedAssetIcon"
import SharedButton from "../../../../Shared/SharedButton"
import SharedInput from "../../../../Shared/SharedInput"
import SharedTooltip from "../../../../Shared/SharedTooltip"
import SharedAddress from "../../../../Shared/SharedAddress"
import { TransactionSignatureSummaryProps } from "./TransactionSignatureSummaryProps"
import TransactionSignatureSummaryBody from "./TransactionSignatureSummaryBody"
import SharedSkeletonLoader from "../../../../Shared/SharedSkeletonLoader"
import { useDappPermission } from "../../../../../hooks/dapp-hooks"

export default function SpendApprovalSummary({
  transactionRequest,
  annotation,
}: TransactionSignatureSummaryProps<AssetApproval>): ReactElement {
  const { currentPermission } = useDappPermission()
  const dappFavicon = currentPermission?.faviconUrl

  const { t } = useTranslation("translation", {
    keyPrefix: "signTransaction.spendApproval",
  })

  const { t: sharedT } = useTranslation("translation", { keyPrefix: "shared" })

  const dispatch = useDispatch()
  const {
    assetAmount: { asset, amount: approvalLimit },
    spender: { address: spenderAddress },
  } = annotation

  const [approvalLimitString, setApprovalLimitString] = useState<string | null>(
    null,
  )

  const [approvalLimitInput, setApprovalLimitInput] = useState<string | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(false)

  const [hasError, setHasError] = useState(false)

  const changing = approvalLimitInput !== null

  const handleChangeClick = () => {
    setApprovalLimitInput(approvalLimitString ?? "")
  }

  const handleCancelClick = () => {
    setIsLoading(false)
    setApprovalLimitInput(null)
  }

  const handleSaveClick = () => {
    setIsLoading(false)
    if (!changing) return

    if (
      approvalLimitInput === "" ||
      approvalLimitInput === approvalLimitString
    ) {
      return
    }

    const decimalAmount = parseToFixedPointNumber(approvalLimitInput)

    if (
      decimalAmount === undefined ||
      (decimalAmount !== null && decimalAmount.amount < 0n)
    ) {
      setHasError(true)
      return
    }

    setIsLoading(true)

    const bigintAmount =
      decimalAmount === null
        ? ethers.constants.MaxUint256.toBigInt()
        : convertFixedPointNumber(decimalAmount, asset.decimals).amount

    setApprovalLimitInput(null)

    const updatedInput = ERC20_INTERFACE.encodeFunctionData(
      ERC20_FUNCTIONS.approve,
      [spenderAddress, hexlify(bigintAmount)],
    )
    dispatch(
      updateTransactionData({
        ...transactionRequest,
        input: updatedInput,
      }),
    )
  }

  useEffect(() => {
    setApprovalLimitString(
      isMaxUint256(approvalLimit)
        ? null
        : fixedPointNumberToString({
            amount: approvalLimit,
            decimals: asset.decimals,
          }),
    )
    setIsLoading(false)
  }, [approvalLimit, asset.decimals])

  useEffect(() => {
    dispatch(
      updateAdditionalSigningStatus(
        approvalLimitInput !== null ? "editing" : undefined,
      ),
    )
  }, [approvalLimitInput, dispatch])

  return (
    <>
      <h1 className="serif_header title">{t("title")}</h1>
      <TransactionSignatureSummaryBody>
        <div className="spend_destination_icons">
          <div className="site_icon" />
          <div className="asset_icon_wrap">
            <SharedAssetIcon
              size="large"
              symbol={asset.symbol}
              logoURL={asset.metadata?.logoURL}
            />
          </div>
        </div>
        <span className="site">
          <Trans
            t={t}
            i18nKey="approveSpender"
            components={{
              spenderAddress: (
                <SharedAddress
                  address={spenderAddress}
                  name={
                    annotation.spender.annotation.nameRecord?.resolved
                      ?.nameOnNetwork.name
                  }
                />
              ),
            }}
          />
        </span>
        <span className="spending_label">
          {t("spendAmount", { assetSymbol: asset.symbol })}
        </span>
        <form onSubmit={(event) => event.preventDefault()}>
          <div className="spend_limit_header">
            <span className="spend_limit_label">{t("spendLimit")}</span>
            <SharedTooltip width={250}>
              <p className="spend_limit_tooltip">{t("tooltip1")}</p>
              <p className="spend_limit_tooltip">{t("tooltip2")}</p>
            </SharedTooltip>
          </div>
          {changing ? (
            <div>
              <SharedInput
                label=""
                value={approvalLimitInput}
                placeholder={approvalLimitString ?? ""}
                onChange={(value) => {
                  setApprovalLimitInput(value)
                  setHasError(false)
                }}
                errorMessage={hasError ? t("invalidAmount") : undefined}
                autoSelect
              />
              <div
                className={classNames("change_limit_actions", {
                  has_error: hasError,
                })}
              >
                <SharedButton
                  size="small"
                  type="tertiary"
                  onClick={handleCancelClick}
                >
                  {sharedT("cancelBtn")}
                </SharedButton>
                <SharedButton
                  size="small"
                  isFormSubmit
                  type="tertiary"
                  onClick={handleSaveClick}
                  isDisabled={
                    approvalLimitInput === "" ||
                    approvalLimitInput === approvalLimitString
                  }
                >
                  {sharedT("saveBtn")}
                </SharedButton>
              </div>
            </div>
          ) : (
            <>
              <SharedSkeletonLoader
                isLoaded={!isLoading}
                width={60}
                height={24}
              >
                <span
                  className={classNames("spend_amount", {
                    has_error: approvalLimitString === null,
                  })}
                >
                  {`${
                    approvalLimitString ?? "Infinite"
                  } ${asset.symbol.toUpperCase()}`}
                </span>
              </SharedSkeletonLoader>
              <SharedButton
                size="small"
                isFormSubmit
                type="tertiary"
                onClick={handleChangeClick}
              >
                {t("changeLimit")}
              </SharedButton>
            </>
          )}
        </form>
        <div className="spacer" />
      </TransactionSignatureSummaryBody>
      <style jsx>
        {`
          .site_icon {
            background: url(${dappFavicon ??
            "./images/dapp_favicon_default@2x.png"});
            background-size: cover;
            width: 48px;
            height: 48px;
            margin-right: -16px;
          }
          .spend_destination_icons {
            display: flex;
            margin-top: 22px;
            margin-bottom: 16px;
          }
          .asset_icon_wrap {
            z-index: var(--z-base);
          }
          .site {
            color: #fff;
            font-size: 16px;
            font-weight: 500;
            line-height: 24px;
            text-align: center;
          }
          .spending_label {
            width: 272px;
            color: var(--green-40);
            font-size: 16px;
            line-height: 24px;
            text-align: center;
            border-bottom: 1px solid var(--green-120);
            padding-bottom: 16px;
            margin-bottom: 16px;
            text-align: center;
          }
          .spend_limit_header {
            display: flex;
            justify-content: center;
          }
          .spend_limit_label {
            color: var(--green-40);
            font-size: 14px;
            line-height: 16px;
            margin-bottom: 4px;
          }
          .spend_limit_tooltip {
            margin: 0 0 5px;
          }
          .spend_limit_tooltip:last-child {
            margin-bottom: 0;
          }
          .change_limit_actions {
            display: flex;
            justify-content: space-between;
          }
          .change_limit_actions.has_error {
            margin-top: 24px;
          }
          .spend_amount {
            color: #fff;
            font-size: 16px;
            line-height: 24px;
          }
          .spend_amount.has_error {
            color: var(--error);
          }
          .spacer {
            margin-bottom: 18px;
          }
        `}
      </style>
    </>
  )
}
