import React, { ReactElement } from "react"
import { Provider } from "react-redux"
import { HashRouter, Route, Switch } from "react-router-dom"
import { Store } from "webext-redux"
import { FeatureFlags, isEnabled } from "@tallyho/tally-background/features"
import Container from "../components/BrowserTab/BrowserTabContainer"
import Snackbar from "../components/Snackbar/Snackbar"
import TabbedOnboardingRoot from "./Onboarding/Tabbed/Root"

import TabNotFound from "./TabNotFound"
import NewCustomNetworkTab from "./NewCustomNetworkTab"

/**
 * Entry point for UI shown in browser tabs.
 */
export default function Tab({ store }: { store: Store }): ReactElement {
  return (
    <>
      <Provider store={store}>
        {/* HashRouter seems the only choice supporting safe page reloads. */}
        <Container>
          <HashRouter>
            <Switch>
              <Route path="/onboarding">
                <TabbedOnboardingRoot />
              </Route>
              {isEnabled(FeatureFlags.SUPPORT_CUSTOM_RPCS) && (
                <Route path="/add-custom-network">
                  <NewCustomNetworkTab />
                </Route>
              )}
              <Route>
                <TabNotFound />
              </Route>
            </Switch>
          </HashRouter>
        </Container>
        <Snackbar isTabbedOnboarding />
      </Provider>
      <>
        <style jsx global>
          {`
            body,
            #tally-root {
              height: 100%;
            }
          `}
        </style>
      </>
    </>
  )
}
