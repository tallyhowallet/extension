/* import { toggleHideDescription } from "@tallyho/tally-background/redux-slices/abilities"
import {
  selectDescriptionHidden,
  selectOpenAbilityCount,
} from "@tallyho/tally-background/redux-slices/selectors"
import classNames from "classnames"
import React  , { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { useHistory } from "react-router-dom"
import { useBackgroundDispatch } from "../../hooks"
import SharedButton from "../Shared/SharedButton" */

export default function AbilitiesHeader(): null /* ReactElement */ {
  /* const { t } = useTranslation("translation", {
    keyPrefix: "abilities",
  })
  const openAbilities = useSelector(selectOpenAbilityCount)
  const hideDescription = useSelector(selectDescriptionHidden)
  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const abilityCount =
    openAbilities > 0
      ? `${openAbilities} ${t("banner.open")}`
      : t("banner.none")

  const handleClick = () => {
    if (!hideDescription) {
      dispatch(toggleHideDescription(true))
    }
    history.push("abilities")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      handleClick()
    }
    } */

  return null
  /* return (
    <div
      className={classNames("abilities_header", {
        small_banner: hideDescription,
        description_banner: !hideDescription,
      })}
      tabIndex={0}
      role="button"
      onClick={hideDescription ? handleClick : undefined}
      onKeyDown={hideDescription ? handleKeyDown : undefined}
    >
      <div className="info_container">
        <div className="abilities_info">
          <div className="icon_tail" />
          <div
            className={classNames({
              header: !hideDescription,
            })}
          >
            {t("header")}
          </div>
        </div>
        <div className="ability_count">{abilityCount}</div>
      </div>
      {!hideDescription && (
        <div>
          <div className="desc">{t("banner.description")}</div>
          <SharedButton
            type="primary"
            size="medium"
            onClick={() => handleClick()}
          >
            {t("banner.seeAbilities")}
          </SharedButton>
        </div>
      )}
      <style jsx>{`
        .info_container {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }

        .abilities_header {
          background: var(--green-95);
          border-radius: 8px;
          padding: 12px 16px 12px 12px;
          width: 100%;
          box-sizing: border-box;
        }

        .small_banner {
          cursor: pointer;
          box-shadow:
            0px 8px 8px rgba(7, 17, 17, 0.24),
            0px 2px 4px rgba(7, 17, 17, 0.12),
            0px 2px 2px rgba(7, 17, 17, 0.22);
          background: radial-gradient(
              78.69% 248.21% at 114.77% 133.93%,
              rgba(9, 86, 72, 0.85) 0%,
              rgba(0, 37, 34, 0) 100%
            ),
            radial-gradient(
              78.69% 248.21% at 0% -133.93%,
              rgb(247, 103, 52, 0.3) 0%,
              rgba(19, 48, 46, 0.5) 100%
            );

          position: relative;
          z-index: var(--z-base);
        }

        .small_banner:before {
          border-radius: 8px;
          background: radial-gradient(
            78.69% 248.21% at 114.77% 133.93%,
            rgba(9, 86, 72, 0.85) 0%,
            rgba(5, 103, 95, 0.35) 100%
          );
          box-shadow:
            0px 16px 16px rgba(7, 17, 17, 0.3),
            0px 6px 8px rgba(7, 17, 17, 0.24),
            0px 2px 4px rgba(7, 17, 17, 0.34);

          position: absolute;
          content: "";
          inset: 0;
          z-index: var(--z-backdrop);
          opacity: 0;
          transition: opacity 0.25s ease-in;
        }

        .small_banner:hover::before {
          opacity: 1;
        }

        .description_banner {
          background: radial-gradient(
            103.39% 72.17% at -5.73% -7.67%,
            rgb(247, 103, 52, 0.5) 0%,
            rgba(19, 48, 46, 0.5) 100%
          );
          box-shadow:
            0px 16px 16px rgba(7, 17, 17, 0.3),
            0px 6px 8px rgba(7, 17, 17, 0.24),
            0px 2px 4px rgba(7, 17, 17, 0.34);
        }

        .abilities_info {
          display: flex;
          flex-direction: row;
          align-items: center;

          color: var(--white);
          font-weight: 400;
          font-size: 16px;
          line-height: 24px;
        }

        .header {
          font-weight: 600;
          font-size: 18px;
        }

        .ability_count {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          background: var(--hunter-green);
          border-radius: 17px;
          padding: 0px 8px;
          height: 24px;

          font-weight: 500;
          font-size: 14px;
          line-height: 16px;
          letter-spacing: 0.03em;
          color: var(--${openAbilities > 0 ? "success" : "green-40"});
        }

        .desc {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          color: var(--green-20);
          margin: 8px 0 16px;
        }

        .icon_tail {
          background: url("./images/tail.svg");
          background-size: 32px 32px;
          width: 32px;
          height: 32px;
          margin-right: 8px;
          border-radius: 24px;
        }
      `}</style>
    </div>
    ) */
}
