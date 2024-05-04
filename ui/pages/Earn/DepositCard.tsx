import React, { ReactElement } from "react"
import { Link } from "react-router-dom"
import { fromFixedPointNumber } from "@tallyho/tally-background/lib/fixed-point"
import {
  APRData,
  AvailableVault,
} from "@tallyho/tally-background/redux-slices/earn"
import { DOGGO } from "@tallyho/tally-background/constants"
import SharedAssetIcon from "../../components/Shared/SharedAssetIcon"
import SharedSkeletonLoader from "../../components/Shared/SharedSkeletonLoader"

export const getDisplayAPR = (
  data: APRData | undefined,
): string | ReactElement => {
  if (typeof data?.totalAPR === "undefined") {
    if (typeof data?.high === "undefined" || typeof data?.low === "undefined") {
      return <SharedSkeletonLoader height={24} width={120} />
    }
    return `${data.low} - ${data.high}`
  }
  return data.totalAPR ?? ""
}

export default function EarnDepositedCard({
  vault,
}: {
  vault: AvailableVault
}): ReactElement | null {
  const { vaultAddress, icons, userDeposited, asset } = vault
  const userDepositedAmount = fromFixedPointNumber(
    {
      amount: userDeposited,
      decimals: asset.decimals,
    },
    4,
  )
  const availableRewards = fromFixedPointNumber(
    {
      amount: vault.pendingRewards,
      decimals: DOGGO.decimals,
    },
    2,
  )
  return (
    <li>
      <Link
        to={{
          pathname: "/earn/deposit",
          state: {
            vaultAddress,
          },
        }}
        className="earn"
      >
        <div className="card">
          <div className="token_meta">
            <div className="type">VAULT</div>
            <div className="asset_icon_wrap">
              {icons && icons?.length > 1 ? (
                <div className="multiple_icons">
                  <div className="single_icon_first">
                    <SharedAssetIcon
                      size="large"
                      symbol={asset?.symbol}
                      logoURL={icons?.[0]}
                    />
                  </div>
                  <div>
                    <SharedAssetIcon
                      size="large"
                      symbol={asset?.symbol}
                      logoURL={icons?.[1]}
                    />
                  </div>
                </div>
              ) : (
                <SharedAssetIcon
                  size="large"
                  symbol={asset?.symbol}
                  logoURL={icons?.[0]}
                />
              )}
            </div>
            <span className="token_name">{asset?.symbol}</span>
          </div>
          <li className="info">
            <span className="amount_type">Total estimated vAPR</span>
            <span className="amount">{getDisplayAPR(vault.APR)}</span>
          </li>
          <li className="info">
            <span className="amount_type">Deposited amount</span>
            <span className="amount">
              {userDepositedAmount}{" "}
              <span className="symbol">{asset?.symbol}</span>
            </span>
          </li>
          <li className="info">
            <span className="amount_type">Available rewards</span>
            <span className="amount">
              {availableRewards.toFixed(2)}{" "}
              <span className="symbol">DOGGO</span>
            </span>
          </li>
          <style jsx>{`
            .card {
              width: 352px;
              height: 176px;
              border-radius: 8px;
              background: linear-gradient(
                var(--green-95) 100%,
                var(--green-95)
              );
              box-sizing: border-box;
              padding: 16px;
              margin-bottom: 20px;
              margin-top: 30px;
              transition: all 0.2s ease;
            }
            .card:hover {
              box-shadow: 0px 10px 12px 0px #0014138a;
              background: linear-gradient(
                180deg,
                #284340 0%,
                var(--green-95) 100%
              );
            }
            .info {
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              margin-bottom: 8px;
            }
            .amount {
              color: #fff;
              font-size: 18px;
              font-weight: 600;
              line-height: 24px;
            }
            .symbol {
              color: white;
              font-weight: 400;
              font-size: 14px;
            }
            .multiple_icons {
              display: flex;
            }
            .single_icon_first {
              z-index: var(--z-settings);
            }
            .multiple_icons div {
              margin: 0 -8px;
            }
            .type {
              height: 17px;
              display: flex;
              justify-content: center;
              align-items: center;
              color: #a4cfff;
              background: #0b4789;
              font-size: 12px;
              padding: 0 4px;
              line-height: 17px;
              max-width: 40px;
            }
            .amount_type {
              color: var(--green-40);
              font-size: 14px;
              font-weight: 500;
              line-height: 16px;
              text-align: right;
            }
            .token_meta {
              display: flex;
              flex-direction: column;
            }
            .token_name {
              color: #fff;
              font-size: 22px;
              font-weight: 500;
              line-height: 32px;
              text-align: center;
              margin-bottom: 10px;
            }
            .asset_icon_wrap {
              display: flex;
              justify-content: center;
              margin-bottom: 6px;
              margin-top: -56px;
            }
          `}</style>
        </div>
      </Link>
    </li>
  )
}
