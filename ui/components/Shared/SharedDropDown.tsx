import React, {
  ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useOnClickOutside } from "../../hooks"
import AccountitemOptionLabel from "../AccountItem/AccountItemOptionLabel"
import SharedIcon from "./SharedIcon"

type DropdownContextValue = {
  isOpen: boolean
  toggle: (value?: boolean) => void
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null)

const useDropdownContext = () => {
  const value = React.useContext(DropdownContext)

  if (!value) {
    throw new Error(
      "Dropdown context is only available inside a Dropdown container",
    )
  }

  return value
}

type DropdownContainerProps = { children: React.ReactNode }

type TogglerProps = {
  children: (toggle: DropdownContextValue["toggle"]) => React.ReactNode
}

type ContentProps = {
  children:
    | React.ReactNode
    | ((dropDownContext: {
        toggle: DropdownContextValue["toggle"]
      }) => React.ReactNode)
}

function DropdownContainer({ children }: DropdownContainerProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownToggle = useCallback(
    (value?: boolean) =>
      setIsOpen(value ?? ((existingValue) => !existingValue)),
    [setIsOpen],
  )

  const contextValue: DropdownContextValue = useMemo<DropdownContextValue>(
    () => ({
      isOpen,
      toggle: dropdownToggle,
    }),
    [isOpen, dropdownToggle],
  )

  return (
    <DropdownContext.Provider value={contextValue}>
      <div
        style={{ position: "relative" }}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

function DropdownToggler({ children }: TogglerProps): ReactElement {
  const { toggle } = useDropdownContext()

  return <div role="presentation">{children(toggle)}</div>
}

function FadeIn({
  isOpen,
  children,
}: {
  isOpen: boolean
  children: React.ReactNode
}): ReactElement {
  const [shouldRender, setShouldRender] = useState(isOpen)

  if (isOpen && !shouldRender) {
    setShouldRender(true)
  }

  const styles: React.CSSProperties = {
    transition: "ease-in .1s",
    opacity: isOpen ? 1 : 0,
  }

  return (
    <div
      style={styles}
      onTransitionEnd={() => {
        if (!isOpen) {
          setShouldRender(false)
        }
      }}
    >
      {shouldRender && children}
    </div>
  )
}

// TODO: Use Portals
function DropdownContent({ children }: ContentProps): ReactElement {
  const { isOpen, toggle } = useDropdownContext()

  const wrapperRef = useRef<HTMLDialogElement>(null)

  useOnClickOutside(wrapperRef, () => toggle(false))

  return (
    <FadeIn isOpen={isOpen}>
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
        <dialog ref={wrapperRef} open={isOpen} className="dropdown-left">
          {typeof children === "function" ? children({ toggle }) : children}
        </dialog>
      </div>
      <style jsx>
        {`
          .dropdown-left {
            position: absolute;
            top: 0;
            left: 100%;
            transform: translateX(calc(-100%));
            width: max-content;
            z-index: var(--z-back-button);
            padding: 0;
            background: none;
            border: none;
            display: block;
          }
        `}
      </style>
    </FadeIn>
  )
}

type DropdownOption = {
  key: string
  onClick?: (e: React.MouseEvent) => void
  icon: string
  label: string
  color?: string
  hoverColor?: string
}

export default function SharedDropdown({
  options,
  toggler,
}: {
  toggler: (toggle: DropdownContextValue["toggle"]) => React.ReactElement
  options: Array<DropdownOption | undefined>
}): React.ReactElement {
  const { t } = useTranslation()

  return (
    <DropdownContainer>
      <DropdownToggler>{toggler}</DropdownToggler>
      <DropdownContent>
        {({ toggle }) => (
          <div style={{ position: "relative" }}>
            <div className="options">
              <SharedIcon
                ariaLabel={t("shared.close")}
                color="var(--green-40)"
                hoverColor="var(--green-20)"
                style={{
                  position: "absolute",
                  top: 16,
                  right: 12,
                  cursor: "pointer",
                }}
                width={12}
                onClick={() => toggle()}
                icon="close.svg"
              />
              <ul className="options">
                {options
                  .filter(
                    (option): option is DropdownOption =>
                      typeof option !== "undefined",
                  )
                  .map(({ key, onClick, icon, label, color, hoverColor }) => (
                    <li key={key} className="option">
                      <button
                        type="button"
                        onClick={(e) => {
                          onClick?.(e)
                          toggle(false)
                        }}
                      >
                        <AccountitemOptionLabel
                          icon={icon}
                          label={label}
                          hoverable
                          color={color}
                          hoverColor={hoverColor}
                        />
                      </button>
                    </li>
                  ))}
              </ul>
              <style jsx>
                {`
                  .icon_settings {
                    mask-image: url("./images/more_dots@2x.png");
                    mask-repeat: no-repeat;
                    mask-position: center;
                    background-color: var(--green-60);
                    mask-size: 20%;
                    width: 4px;
                    height: 20px;
                    border: 10px solid transparent;
                  }
                  .icon_settings:hover {
                    background-color: var(--green-40);
                  }
                  div.options {
                    display: block;

                    margin: 0;
                    padding: 0;

                    cursor: default;
                    background-color: var(--green-120);
                    width: 212px;
                    border-radius: 4px;
                    z-index: var(--z-base);

                    box-shadow:
                      0px 2px 4px 0px #00141357,
                      0px 6px 8px 0px #0014133d,
                      0px 16px 16px 0px #00141324;
                  }
                  ul.options {
                    display: flex;
                    padding: 7px 0;
                    align-items: center;
                    flex-direction: column;
                    justify-content: space-between;
                  }
                  .option {
                    display: flex;
                    line-height: 24px;
                    padding: 7px;
                    flex-direction: row;
                    width: 90%;
                    align-items: center;
                    height: 100%;
                    cursor: default;
                    justify-content: space-between;
                  }
                `}
              </style>
            </div>
          </div>
        )}
      </DropdownContent>
    </DropdownContainer>
  )
}
