import React, { ReactElement, useCallback } from "react"

import { matchPath, useHistory, useLocation } from "react-router-dom"
import {
  selectCurrentNetwork,
  // selectOpenAbilityCount,
} from "@tallyho/tally-background/redux-slices/selectors"
import { NETWORKS_SUPPORTING_SWAPS } from "@tallyho/tally-background/constants/networks"
import { EVMNetwork } from "@tallyho/tally-background/networks"
import { useTranslation } from "react-i18next"
import TabBarIconButton from "./TabBarIconButton"
import tabs, { defaultTab, TabInfo } from "../../utils/tabs"
import { useBackgroundSelector } from "../../hooks"

const isTabSupportedByNetwork = (tab: TabInfo, network: EVMNetwork) => {
  switch (tab.path) {
    case "/swap":
      return NETWORKS_SUPPORTING_SWAPS.has(network.chainID)
    default:
      return true
  }
}

export default function TabBar(): ReactElement {
  const location = useLocation()
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  // const abilityCount = useBackgroundSelector(selectOpenAbilityCount)

  const history = useHistory()
  const { t } = useTranslation()

  const noActiveTab = ["abilities"].some((pathName) =>
    location.pathname.includes(pathName),
  )

  const activeTab =
    tabs.find(({ path }) =>
      matchPath(location.pathname, { path, exact: false }),
    ) ?? defaultTab

  const hasNotifications = useCallback(
    (path: string): boolean => {
      switch (path) {
        case "/portfolio":
          return false // abilityCount > 0
        default:
          return false
      }
    },
    [
      /* abilityCount */
    ],
  )

  return (
    <nav aria-label="Main">
      {tabs
        .filter((tab) => isTabSupportedByNetwork(tab, selectedNetwork))
        .map(({ path, title, icon }) => (
          <TabBarIconButton
            key={path}
            icon={icon}
            title={t(title)}
            onClick={() => history.push(path)}
            isActive={noActiveTab ? false : activeTab.path === path}
            showNotifications={hasNotifications(path)}
          />
        ))}
      <style jsx>
        {`
          nav {
            width: 100%;
            height: 56px;
            background-color: var(--hunter-green);
            display: flex;
            justify-content: space-around;
            box-sizing: border-box;
            align-items: center;
            flex-shrink: 0;
            box-shadow: 0 0 5px rgba(0, 20, 19, 0.5);
            z-index: var(--z-back-button);
          }
        `}
      </style>
    </nav>
  )
}
