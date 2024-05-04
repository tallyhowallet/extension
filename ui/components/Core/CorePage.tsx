import React, { ReactElement } from "react"
import Snackbar from "../Snackbar/Snackbar"
import TabBar from "../TabBar/TabBar"
import TopMenu from "../TopMenu/TopMenu"

interface Props {
  children: React.ReactNode
  hasTopBar?: boolean
  hasTabBar?: boolean
}

export default function CorePage(props: Props): ReactElement {
  const { children, hasTopBar, hasTabBar } = props

  return (
    <section>
      {hasTopBar && <TopMenu />}
      <main>
        {children}
        <Snackbar />
      </main>
      {hasTabBar && <TabBar />}
      <style jsx>
        {`
          section {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          main {
            width: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            margin: 0 auto;
            align-items: center;
            background-color: var(--hunter-green);
            height: 100%;
          }
          .top_menu_wrap {
            z-index: var(--z-back-button);
            cursor: default;
          }
        `}
      </style>
    </section>
  )
}

CorePage.defaultProps = {
  hasTopBar: true,
}
