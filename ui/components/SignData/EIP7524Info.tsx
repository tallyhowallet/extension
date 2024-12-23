import React, { ReactElement } from "react"
import { MessageSigningRequest } from "@tallyho/tally-background/utils/signing"
import { useTranslation } from "react-i18next"

type Props = {
  signingData: MessageSigningRequest["signingData"]
}

export default function EIP7524Info({ signingData }: Props): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "signing" })

  return (
    <>
      <div className="message">
        <div className="message-title">{t("message")}</div>
        <div className="light">{`${signingData}`}</div>
      </div>
      <style jsx>{`
        .message {
          margin: 16px;
          width: 100%;
          overflow-wrap: anywhere;
          color: --var(green-20);
        }
        .message-title {
          color: var(--green-40);
          margin-bottom: 6px;
        }
        .light {
          color: #ccd3d3;
          white-space: pre-wrap;
        }
        .label {
          color: var(--green-40);
        }
        .header {
          padding: 16px 0;
        }
        .signed {
          margin-bottom: 6px;
        }
      `}</style>
    </>
  )
}
