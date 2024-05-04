import { getAllAddresses } from "@tallyho/tally-background/redux-slices/selectors"
import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
// eslint-disable-next-line import/no-extraneous-dependencies
import css from "styled-jsx/css"
import WalletShortcut from "../../../components/Onboarding/WalletShortcut"
import { useBackgroundSelector } from "../../../hooks"

const styles = css`
  section {
    text-align: center;
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
    margin-bottom: 32px;
  }

  header div {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  header h1 {
    display: inline-block;
    font-family: "Quincy CF";
    font-weight: 500;
    font-size: 36px;
    line-height: 42px;
    margin: 0;
    color: var(--white);
  }

  header span {
    font-family: "Segment";
    font-style: normal;
    font-weight: 400;
    font-size: 16px;
    line-height: 24px;
    color: var(--green-40);
  }

  header img {
    border-radius: 22px;
  }

  .wrapper {
    position: relative;
    z-index: var(--z-base);
  }

  .confetti {
    position: absolute;
    display: none;
    opacity: 0.7;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .shortcut_container {
    background: var(--green-95);
    padding: 35px 32px 29px;
    max-width: 402px;
    margin: 0 auto;
    border-radius: 4px;
  }
`

export default function Done(): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.complete",
  })

  const firstAddress = useBackgroundSelector(getAllAddresses).length === 1

  if (!firstAddress) {
    return (
      <section>
        <div className="confetti">
          <img src="./images/confetti.svg" alt="Confetti" />
        </div>
        <div className="wrapper fade_in">
          <header>
            <img
              width="80"
              height="80"
              alt="Taho Gold"
              src="./images/doggo_gold.svg"
              className="illustration"
            />
            <div>
              <h1>{t("titleExisting")}</h1>
            </div>
          </header>
        </div>
        <div className="shortcut_container">
          <WalletShortcut />
        </div>
        <style jsx>{styles}</style>
      </section>
    )
  }

  return (
    <section>
      <div className="confetti">
        <img src="./images/confetti.svg" alt="Confetti" />
      </div>
      <div className="wrapper fade_in">
        <header>
          <img
            width="80"
            height="80"
            alt="Taho Gold"
            src="./images/doggo_gold.svg"
            className="illustration"
          />
          <div>
            <h1>{t("title")}</h1>
            <span>{t("subtitle")}</span>
          </div>
        </header>
        <img
          width="383"
          src="./images/onboarding_pin_extension.gif"
          alt={t("animationAlt")}
        />
      </div>
      <style jsx>{styles}</style>
    </section>
  )
}
