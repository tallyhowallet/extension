import React, { Dispatch, ReactElement, SetStateAction, useRef } from "react"
import { useOnClickOutside } from "../../hooks"
import SharedButton from "./SharedButton"

interface SharedModalProps {
  setModalVisible: Dispatch<SetStateAction<boolean>>
}

export default function SharedInfoModal({
  setModalVisible,
}: SharedModalProps): ReactElement {
  const modalWrapRef = useRef(null)
  useOnClickOutside(modalWrapRef, () => {
    setModalVisible(false)
  })

  return (
    <>
      <div className="backdrop" />
      <div className="wrap" ref={modalWrapRef}>
        <div className="content">
          <div className="title"> Why Delegate?</div>
          <div>Read this text and chose your own degenerate.</div>
          <SharedButton
            type="primary"
            size="medium"
            onClick={() => setModalVisible(false)}
          >
            Understood
          </SharedButton>
        </div>
      </div>
      <style jsx>{`
        .wrap {
          width: 100vw;
          height: 100vh;
          display: flex;
          position: absolute;
          justify-content: center;
          align-items: center;
          z-index: var(--z-expnaded);
        }

        @keyframes slideup {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0%);
          }
        }
        .backdrop {
          opacity: 0.7;
          width: 100vw;
          height: 100vh;
          background: #001413;
          position: absolute;
          z-index: var(--z-expnaded);
        }
        .content {
          width: 70vw;
          height: 70vh;
          padding: 24px;
          background: #001413;
          z-index: var(--z-content;
          text-align: center;
          display: flex;
          flex-flow: column;
          justify-content: center;
          align-items: center;
          gap: 12px;
          border-radius: 12px;
          animation-name: slideup;
          animation-duration: 0.4s;
        }
        .title {
          font-size: 18px;
          line-height: 24px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          color: #d64045;
        }
        .button {
          height: 40px;
          border-radius: 4px;
          background-color: var(--trophy-gold);
          color: #002522;
          font-size: 20px;
          letter-spacing: 0.48px;
          line-height: 24px;
          text-align: center;
          padding: 0px 17px;
          margin-bottom: 16px;
          margin-right: 8px;
          z-index: var(--z-settings);
        }
      `}</style>
    </>
  )
}
