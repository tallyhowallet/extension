import React, { ReactElement, ReactNode, useRef } from "react"
import { createPortal } from "react-dom"
import classNames from "classnames"
import { useOnClickOutside } from "../../hooks"

interface SharedModalProps {
  children: ReactNode
  header?: string
  onClose: () => void
  isOpen: boolean
  minHeight?: string
  width?: string
  closeOnOverlayClick?: boolean
  bgColor?: string
  shadowBgColor?: string
}

const modalElement = document.getElementById("tally-root") as HTMLElement

export default function SharedModal({
  children,
  header,
  onClose,
  isOpen,
  minHeight,
  width,
  bgColor,
  shadowBgColor,
  closeOnOverlayClick = true,
}: SharedModalProps): ReactElement {
  const ref = useRef(null)

  useOnClickOutside(ref, closeOnOverlayClick ? onClose : () => {})

  return createPortal(
    isOpen ? (
      <>
        <div className={classNames("modal", { open: isOpen })}>
          <div className="modal_overlay" />
          <div className="modal_content" ref={ref}>
            <button type="button" aria-label="close modal">
              <button
                type="button"
                className="icon_close"
                onClick={onClose}
                aria-label="close modal"
              />
            </button>
            <div className="modal_body">
              {header && <h2 className="modal_header">{header}</h2>}
              {children}
            </div>
          </div>
        </div>
        <style jsx>{`
          .modal {
            position: fixed;
            display: none;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: var(--z-menu);
            align-items: center;
            justify-content: center;
          }
          .modal.open {
            display: flex;
          }
          .modal_overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: ${shadowBgColor || "var(--hunter-green)"};
            opacity: 0.7;
          }
          .modal_content {
            position: relative;
            display: flex;
            align-items: center;
            z-index: var(--z-base);
            box-sizing: border-box;
            width: ${width || "312px"};
            background-color: ${bgColor || "var(--green-120)"};
            padding: 24px;
            box-shadow:
              0px 24px 24px rgba(0, 20, 19, 0.14),
              0px 14px 16px rgba(0, 20, 19, 0.24),
              0px 10px 12px rgba(0, 20, 19, 0.34);
            border-radius: 8px;
            min-height: ${minHeight || "auto"};
            transition:
              min-height 1.2s ease-in-out,
              opacity 0.2s ease-in-out;
          }
          .icon_close {
            mask-image: url("./images/close.svg");
            mask-size: cover;
            width: 11px;
            height: 11px;
            position: absolute;
            right: 16px;
            top: 16px;
            background-color: var(--green-20);
            z-index: var(--z-base);
          }
          .modal_body {
            min-height: 320px;
            flex: 1;
          }
          .modal_header {
            color: var(--green-20);
            font-size: 18px;
            line-height: 24px;
            margin-bottom: 24px;
          }
        `}</style>
      </>
    ) : null,
    modalElement,
  )
}
