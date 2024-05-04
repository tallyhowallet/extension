import React, { ReactElement, useState } from "react"
import { EnrichedAvailableVault } from "@tallyho/tally-background/redux-slices/earn"
import { Link } from "react-router-dom"
import { EarnStages } from "@tallyho/tally-background/constants"
import classNames from "classnames"
import SharedAssetIcon from "../../components/Shared/SharedAssetIcon"
import SharedSkeletonLoader from "../../components/Shared/SharedSkeletonLoader"
import { getDisplayAPR } from "./DepositCard"
import Clock from "../../components/Earn/Clock"

type EarnCardProps = {
  vault: EnrichedAvailableVault
}

export default function EarnCard({ vault }: EarnCardProps): ReactElement {
  const [stage] = useState(EarnStages.Live) // TODO

  return (
    <li
      className={classNames({
        disabled: stage !== EarnStages.Live,
      })}
    >
      <Link
        to={{
          pathname: "/earn/deposit",
          state: {
            vaultAddress: vault.vaultAddress,
          },
        }}
        className="earn"
      >
        <div className="card">
          <div className="asset_icon_wrap">
            {vault.icons && vault.icons?.length > 1 ? (
              <div className="multiple_icons">
                <div className="single_icon_first">
                  <SharedAssetIcon
                    size="large"
                    symbol={vault?.asset?.symbol}
                    logoURL={vault.icons?.[0]}
                  />
                </div>
                <div>
                  <SharedAssetIcon
                    size="large"
                    symbol={vault?.asset?.symbol}
                    logoURL={vault.icons?.[1]}
                  />
                </div>
              </div>
            ) : (
              <SharedAssetIcon
                size="large"
                symbol={vault?.asset?.symbol}
                logoURL={vault.icons?.[0]}
              />
            )}
          </div>
          <span className="token_name">{vault?.asset?.symbol}</span>
          {stage === EarnStages.ComingSoon && (
            <div className="coming_soon">
              <div className="coming_soon_dots">...</div>
              Coming soon
            </div>
          )}
          {stage === EarnStages.PartialyLive && (
            <>
              <div className="launching">Launching in</div>
              <Clock />
            </>
          )}
          {stage === EarnStages.Live && (
            <>
              <div className="info">
                <div className="label">Total estimated vAPR</div>
                <div className="value">{getDisplayAPR(vault.APR)}</div>
              </div>
              <div className="divider" />
              <div className="info">
                <div className="label">TVL</div>
                <div className="value">
                  {vault.localValueTotalDeposited ? (
                    `$${vault.localValueTotalDeposited}`
                  ) : (
                    <SharedSkeletonLoader height={24} width={120} />
                  )}
                </div>
              </div>
              <div className="divider" />
              <div className="info">
                <div className="label">Reward</div>
                <div className="rewards_wrap">
                  <div className="doggo_rewards">
                    <img
                      className="lock"
                      src="./images/lock@2.png"
                      alt="Locked"
                    />
                    DOGGO
                  </div>
                  <div className="other_reward ellipsis">
                    + {vault.asset.symbol}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Link>
      <style jsx>{`
        .disabled {
          pointer-events: none;
        }
        .card {
          width: 160px;
          height: 266px;
          border-radius: 8px;
          flex-shrink: 0;
          display: flex;
          background: linear-gradient(var(--green-95) 100%, var(--green-95));
          flex-direction: column;
          align-items: center;
          margin-top: 26px;
          margin-bottom: 16px;
          transition: all 0.2s ease;
          color: white;
        }
        .card:hover {
          background: linear-gradient(180deg, #034f4b 0%, #033633 100%);
          box-shadow:
            0px 24px 24px rgba(0, 20, 19, 0.04),
            0px 14px 16px rgba(0, 20, 19, 0.14),
            0px 10px 12px rgba(0, 20, 19, 0.54);
        }
        .value {
          font-size: 18px;
          line-height: 24px;
          font-weight: bold;
        }
        .info {
          display: flex;
          flex-flow: column;
          padding: 8px 0;
          gap: 4px;
          justify-content: center;
          align-items: center;
          color: white;
        }
        .rewards_wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 150px;
          margin-top: 4px;
        }
        .doggo_rewards {
          display: flex;
          align-items: center;
          border-radius: 4px;
          padding: 4px;
          background-color: var(--hunter-green);
        }
        .other_reward {
          padding-left: 2px;
        }

        .asset_icon_wrap {
          border-radius: 500px;
          margin-top: -18px;
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
        .token_name {
          font-weight: bold;
          color: white;
          font-size: 18px;
          font-weight: 500;
          line-height: 24px;
          text-transform: uppercase;
          margin-top: 4px;
          margin-bottom: 8px;
        }
        .lock {
          height: 13px;
          margin-right: 4px;
          display: inline-block;
        }
        .divider {
          width: 128px;
          height: unset;
          opacity: 100%;
          border-bottom: 1px solid var(--green-120);
        }
        .coming_soon {
          margin-top: 20px;
          color: var(--attention);
          font-size: 22px;
          font-weight: 500;
          line-height: 32px;
          text-align: center;
        }
        .coming_soon_dots {
          font-size: 48px;
          line-height: 48px;
        }
        .launching {
          margin: 20px 0 8px;
          color: var(--success);
          font-size: 22px;
          font-weight: 500;
          line-height: 32px;
        }
      `}</style>
    </li>
  )
}
