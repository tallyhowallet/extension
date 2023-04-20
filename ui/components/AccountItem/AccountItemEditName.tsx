import React, { useState, useEffect, useCallback, ReactElement } from "react"
import { AccountTotal } from "@tallyho/tally-background/redux-slices/selectors"
import { addOrEditAddressName } from "@tallyho/tally-background/redux-slices/accounts"
import { useDispatch } from "react-redux"
import { AddressOnNetwork } from "@tallyho/tally-background/accounts"
import { useTranslation } from "react-i18next"
import SharedButton from "../Shared/SharedButton"
import SharedAccountItemSummary from "../Shared/SharedAccountItemSummary"
import AccountItemActionHeader from "./AccountItemActionHeader"
import SharedInput from "../Shared/SharedInput"

interface AccountItemEditNameProps {
  account: AccountTotal
  addressOnNetwork: AddressOnNetwork
  close: () => void
}

export default function AccountItemEditName({
  account,
  addressOnNetwork,
  close,
}: AccountItemEditNameProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "accounts.accountItem",
  })
  const dispatch = useDispatch()
  const [newName, setNewName] = useState("")
  const [error, setError] = useState("")
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched && newName.trim() === "") {
      setError(t("noNameError"))
    } else {
      setError("")
    }
  }, [newName, error, touched, t])

  const onSubmit = useCallback(
    (
      event:
        | React.FormEvent<HTMLFormElement>
        | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      event.preventDefault()
      if (!newName) {
        setTouched(true)
        setError(t("noNameError"))
        return
      }
      if (error) {
        return
      }
      dispatch(
        addOrEditAddressName({
          ...addressOnNetwork,
          name: newName,
        })
      )
      close()
    },
    [addressOnNetwork, close, dispatch, error, newName, t]
  )

  return (
    <div className="edit_address_name">
      <div className="header">
        <AccountItemActionHeader
          label={t("editName")}
          icon="icons/s/edit.svg"
          color="#fff"
        />
      </div>
      <div className="account_container standard_width">
        <SharedAccountItemSummary accountTotal={account} isSelected={false} />
      </div>
      <div
        className="details"
        role="presentation"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <SharedInput
            label=""
            placeholder={t("typeNewName")}
            errorMessage={error}
            autoFocus
            onChange={(value) => {
              if (!touched) {
                setTouched(true)
              }
              setNewName(value)
            }}
          />
        </form>
      </div>
      <div className="button_container">
        <SharedButton
          type="secondary"
          size="medium"
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
        >
          {t("cancel")}
        </SharedButton>
        <SharedButton type="primaryGreen" size="medium" onClick={onSubmit}>
          {t("saveName")}
        </SharedButton>
      </div>
      <style jsx>{`
        li {
        }
        .header {
          height: 24px;
        }
        .edit_address_name {
          margin-left: 20px;
          margin-right: 20px;
          display: flex;
          flex-direction: column;
          height: 95%;
        }
        form {
          margin-top: 0px;
        }
        .details {
          line-height: 24px;
          font-size: 16px;
          margin-top: 21px;
        }
        .button_container {
          margin-top: 52px;
          display: flex;
          flex-direction: row;
          justify-content: space-between;
        }
        .account_container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 0 auto;
          width: 336px;
          height: 52px;
          margin-top: 15px;
          background-color: var(--hunter-green);
          padding: 5px;
          border-radius: 16px;
        }
      `}</style>
    </div>
  )
}
