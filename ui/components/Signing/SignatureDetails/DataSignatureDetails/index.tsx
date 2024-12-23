import classNames from "classnames"
import React, { ReactNode, ReactElement } from "react"
import { useTranslation } from "react-i18next"

type DataSignatureDetailsProps = {
  requestingSource?: string | undefined
  excludeTitle?: boolean
  children: ReactNode
  alternativeTitle?: string
}

export default function DataSignatureDetails({
  requestingSource,
  excludeTitle = false,
  alternativeTitle = undefined,
  children,
}: DataSignatureDetailsProps): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "signing" })

  return (
    <div className="primary_info_card standard_width">
      <div className="sign_block">
        <div className="container">
          {!excludeTitle && !alternativeTitle && (
            <div className="label header">{t("signatureRequired")}</div>
          )}
          {alternativeTitle && (
            <div className="label header">{alternativeTitle}</div>
          )}
          <div
            className={classNames({ source: requestingSource !== undefined })}
          >
            {requestingSource}
          </div>
          {children}
        </div>
      </div>
      <style jsx>{`
        .primary_info_card {
          display: block;
          height: fit-content;
          border-radius: 16px;
          background-color: var(--hunter-green);
          margin: 0 0 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sign_block {
          display: flex;
          width: 100%;
          flex-direction: column;
          justify-content: space-between;
        }
        .container {
          display: flex;
          margin: 15px 20px 15px 25px;
          flex-direction: column;
          align-items: center;
          font-size: 16px;
          line-height: 24px;
        }
        .header,
        .source {
          padding: 5px 0 15px;
          font-size: 16px;
          margin: 0 16px;
          align-self: stretch;
          border-bottom: 1px solid var(--green-120);
          justify-content: center;
          text-align: center;
        }
        .header + .source {
          padding-top: 16px;
        }
        .source {
          font-weight: 500;
          line-height: 24px;
        }
      `}</style>
    </div>
  )
}
