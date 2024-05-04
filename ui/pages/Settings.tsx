import React, { ReactElement, useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Trans, useTranslation } from "react-i18next"
import {
  selectHideDust,
  toggleHideDust,
  selectShowNotifications,
  setShouldShowNotifications,
  selectShowTestNetworks,
  toggleTestNetworks,
  toggleHideBanners,
  selectHideBanners,
  selectShowUnverifiedAssets,
  toggleShowUnverifiedAssets,
  toggleFlashbots,
  selectUseFlashbots,
  selectAutoLockTimer as selectAutoLockInterval,
  updateAutoLockInterval,
} from "@tallyho/tally-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import { FLASHBOTS_DOCS_URL, MINUTE } from "@tallyho/tally-background/constants"
import {
  selectMainCurrencySign,
  userValueDustThreshold,
} from "@tallyho/tally-background/redux-slices/selectors"
import {
  FeatureFlags,
  isEnabled,
  wrapIfEnabled,
} from "@tallyho/tally-background/features"
import SharedToggleButton from "../components/Shared/SharedToggleButton"
import SharedSelect from "../components/Shared/SharedSelect"
import { getLanguageIndex, getAvalableLanguages } from "../_locales"
import { getLanguage, setLanguage } from "../_locales/i18n"
import SettingButton from "./Settings/SettingButton"
import { useBackgroundSelector } from "../hooks"
import SharedIcon from "../components/Shared/SharedIcon"
import SharedTooltip from "../components/Shared/SharedTooltip"
import SharedLink from "../components/Shared/SharedLink"

type SettingsItem = {
  title: string
  component: () => ReactElement
  tooltip?: () => ReactElement
}

type SettingsList = {
  [key: string]: {
    title: string
    items: SettingsItem[]
  }
}

const NUMBER_OF_CLICKS_FOR_DEV_PANEL = 15

const FAQ_URL =
  "https://notion.taho.xyz/Tally-Ho-Knowledge-Base-4d95ed5439c64d6db3d3d27abf1fdae5"

const AUTO_LOCK_OPTIONS = [
  { label: "5", value: String(5 * MINUTE) },
  { label: "15", value: String(15 * MINUTE) },
  { label: "30", value: String(30 * MINUTE) },
  { label: "60", value: String(60 * MINUTE) },
]

const FOOTER_ACTIONS = [
  {
    icon: "icons/m/discord",
    linkTo: "https://chat.taho.xyz/",
  },
  {
    icon: "twitter",
    linkTo: "https://twitter.com/taho_xyz",
  },
  {
    icon: "icons/m/github",
    linkTo: "https://github.com/tallyhowallet/extension",
  },
]

function VersionLabel(): ReactElement {
  const { t } = useTranslation()
  const history = useHistory()
  const [clickCounter, setClickCounter] = useState(0)
  const [isHover, setIsHover] = useState(false)

  useEffect(() => {
    if (
      isEnabled(FeatureFlags.SWITCH_RUNTIME_FLAGS) &&
      clickCounter === NUMBER_OF_CLICKS_FOR_DEV_PANEL &&
      isHover
    ) {
      setIsHover(false)
      setClickCounter(0)
      history.push("/dev")
    }
  }, [clickCounter, history, isHover])

  return (
    <div className="version">
      <button
        type="button"
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        onClick={() => setClickCounter((prevState) => prevState + 1)}
      >
        {t("settings.versionLabel", {
          version: process.env.VERSION ?? t("settings.unknownVersionOrCommit"),
        })}
        {process.env.COMMIT_SHA?.slice(0, 7) ??
          t("settings.unknownVersionOrCommit")}
      </button>
      <style jsx>
        {`
          .version {
            margin: 16px 0;
            color: var(--green-40);
            font-size: 16px;
            font-weight: 500;
            margin: 0 auto;
            padding: 16px 0px;
          }
        `}
      </style>
    </div>
  )
}

function SettingRow(props: SettingsItem): ReactElement {
  const { title, component, tooltip = () => null } = props

  return (
    <li>
      <div className="left">
        {title}
        {tooltip()}
      </div>
      <div className="right">{component()}</div>
      <style jsx>
        {`
          .left {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          li {
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            color: var(--green-20);
            font-size: 18px;
            font-weight: 600;
            line-height: 24px;
          }
        `}
      </style>
    </li>
  )
}

export default function Settings(): ReactElement {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const hideDust = useSelector(selectHideDust)
  const hideBanners = useSelector(selectHideBanners)
  const showTestNetworks = useSelector(selectShowTestNetworks)
  const showUnverifiedAssets = useSelector(selectShowUnverifiedAssets)
  const shouldShowNotifications = useSelector(selectShowNotifications)
  const useFlashbots = useSelector(selectUseFlashbots)
  const mainCurrencySign = useBackgroundSelector(selectMainCurrencySign)

  const toggleHideDustAssets = (toggleValue: boolean) => {
    dispatch(toggleHideDust(toggleValue))
  }

  const toggleNotifications = (toggleValue: boolean) => {
    dispatch(setShouldShowNotifications(toggleValue))
  }

  const toggleShowTestNetworks = (defaultWalletValue: boolean) => {
    dispatch(toggleTestNetworks(defaultWalletValue))
  }

  const toggleShowUnverified = (toggleValue: boolean) => {
    dispatch(toggleShowUnverifiedAssets(toggleValue))
  }

  const toggleHideNotificationBanners = (toggleValue: boolean) => {
    dispatch(toggleHideBanners(!toggleValue))
  }

  const toggleFlashbotsRPC = (value: boolean) =>
    dispatch(toggleFlashbots(value))

  const hideSmallAssetBalance = {
    title: t("settings.hideSmallAssetBalance", {
      amount: userValueDustThreshold,
      sign: mainCurrencySign,
    }),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleHideDustAssets(toggleValue)}
        value={hideDust}
      />
    ),
  }

  const unverifiedAssets = {
    title: t("settings.showUnverifiedAssets"),
    tooltip: () => (
      <SharedTooltip width={190} style={{ marginLeft: 4 }}>
        <Trans t={t} i18nKey="settings.unverifiedAssets.tooltip" />
      </SharedTooltip>
    ),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleShowUnverified(toggleValue)}
        value={showUnverifiedAssets}
      />
    ),
  }

  const toggleShowNotifications = {
    title: t("settings.showNotifications"),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleNotifications(toggleValue)}
        value={shouldShowNotifications}
      />
    ),
  }

  const enableTestNetworks = {
    title: t("settings.enableTestNetworks"),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleShowTestNetworks(toggleValue)}
        value={showTestNetworks}
      />
    ),
  }

  const langOptions = getAvalableLanguages()
  const langIdx = getLanguageIndex(getLanguage())
  const languages = {
    title: t("settings.language"),
    component: () => (
      <SharedSelect
        width={194}
        options={langOptions}
        onChange={setLanguage}
        defaultIndex={langIdx}
      />
    ),
  }

  const needHelp = {
    title: "",
    component: () => (
      <SettingButton
        label={t("settings.needHelp")}
        ariaLabel={t("settings.needHelp")}
        icon="new-tab"
        onClick={() => window.open(FAQ_URL, "_blank")?.focus()}
      />
    ),
  }

  const bugReport = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/export-logs"
        label={t("settings.bugReport")}
        ariaLabel={t("settings.exportLogs.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const dAppsSettings = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/connected-websites"
        label={t("settings.connectedWebsites")}
        ariaLabel={t("settings.connectedWebsitesSettings.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const addCustomAsset = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/add-custom-asset"
        label={t("settings.addCustomAsset")}
        ariaLabel={t("settings.connectedWebsitesSettings.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const analytics = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/analytics"
        label={t("settings.analytics")}
        ariaLabel={t("settings.analyticsSetUp.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const autoLockInterval = useBackgroundSelector(selectAutoLockInterval)

  const autoLockSettings = {
    title: t("settings.autoLockTimer.label"),
    tooltip: () => (
      <SharedTooltip width={190} style={{ marginLeft: 4 }}>
        <div className="tooltip">
          <span>{t("settings.autoLockTimer.tooltip")}</span>
        </div>
      </SharedTooltip>
    ),
    component: () => (
      <>
        <div className="select_wrapper">
          <SharedSelect
            options={AUTO_LOCK_OPTIONS.map((item) => ({
              ...item,
              label: t("settings.autoLockTimer.interval", { time: item.label }),
            }))}
            defaultIndex={AUTO_LOCK_OPTIONS.findIndex(
              ({ value }) => value === String(autoLockInterval),
            )}
            width="100%"
            onChange={(newValue) => dispatch(updateAutoLockInterval(newValue))}
          />
        </div>
        <style jsx>
          {`
            .select_wrapper {
              width: 118px;
              z-index: var(--z-settings);
            }
          `}
        </style>
      </>
    ),
  }

  const notificationBanner = {
    title: t("settings.showBanners"),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleHideNotificationBanners(toggleValue)}
        value={!hideBanners}
      />
    ),
  }

  const customNetworks = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/custom-networks"
        label={t("settings.customNetworks")}
        ariaLabel={t("settings.customNetworksSettings.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const flashbotsRPC = {
    title: t("settings.useFlashbots"),
    tooltip: () => (
      <SharedTooltip
        width={165}
        style={{ marginLeft: 4 }}
        verticalPosition="top"
      >
        <Trans
          t={t}
          i18nKey="settings.useFlashbotsTooltip"
          components={{
            url: <SharedLink type="tooltip" url={FLASHBOTS_DOCS_URL} />,
          }}
        />
      </SharedTooltip>
    ),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleFlashbotsRPC(toggleValue)}
        value={useFlashbots}
      />
    ),
  }

  const settings: SettingsList = {
    general: {
      title: t("settings.group.general"),
      items: [
        dAppsSettings,
        analytics,
        ...wrapIfEnabled(FeatureFlags.SUPPORT_MULTIPLE_LANGUAGES, languages),
        ...wrapIfEnabled(
          FeatureFlags.SUPPORT_ACHIEVEMENTS_BANNER,
          notificationBanner,
        ),
      ],
    },
    walletOptions: {
      title: t("settings.group.walletOptions"),
      items: [
        toggleShowNotifications,
        hideSmallAssetBalance,
        unverifiedAssets,
        customNetworks,
        addCustomAsset,
        enableTestNetworks,
        flashbotsRPC,
        autoLockSettings,
      ],
    },
    helpCenter: {
      title: t("settings.group.helpCenter"),
      items: [bugReport, needHelp],
    },
  }

  return (
    <section className="standard_width_padded">
      <div className="menu">
        <h1>{t("settings.mainMenu")}</h1>
        <ul>
          {Object.values(settings).map(({ title, items }) => (
            <div className="group" key={title}>
              <span className="group_title">{title}</span>
              {items.map((item, index) => {
                const key = `${title}-${item.title}-${index}`
                return (
                  <SettingRow
                    key={key}
                    title={item.title}
                    component={item.component}
                    tooltip={item.tooltip}
                  />
                )
              })}
            </div>
          ))}
        </ul>
      </div>
      <div className="footer">
        <div className="action_icons">
          {FOOTER_ACTIONS.map(({ icon, linkTo }) => (
            <SharedIcon
              key={icon}
              icon={`${icon}.svg`}
              width={18}
              color="var(--green-20)"
              hoverColor="var(--trophy-gold)"
              transitionHoverTime="0.2s"
              onClick={() => {
                window.open(linkTo, "_blank")?.focus()
              }}
            />
          ))}
        </div>
        <VersionLabel />
      </div>
      <style jsx>
        {`
          section {
            display: flex;
            flex-flow: column;
            justify-content: space-between;
            height: 544px;
            background-color: var(--hunter-green);
          }
          .menu {
            display: flex;
            justify-content: space-between;
            display: flex;
            flex-direction: column;
          }
          h1 {
            color: #fff;
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            margin-bottom: 28px;
          }
          span {
            color: var(--green-40);
            font-size: 16px;
            font-weight: 400;
            line-height: 24px;
          }
          .footer {
            width: 100vw;
            margin-top: 20px;
            margin-left: -24px;
            background-color: var(--green-95);
            text-align: center;
            padding-top: 16px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .action_icons {
            display: flex;
            justify-content: center;
            gap: 24px;
          }
          .group {
            border-bottom: 1px solid var(--green-80);
            margin-bottom: 24px;
            padding-bottom: 24px;
          }
          .group:last-child {
            border-bottom: none;
            padding: 0px;
            margin: 0px;
          }
          .group_title {
            color: var(--green-40);
            font-family: "Segment";
            font-style: normal;
            font-weight: 400;
            font-size: 16px;
            line-height: 24px;
          }
        `}
      </style>
    </section>
  )
}
