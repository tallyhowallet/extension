import React, { ReactElement, useEffect, useState } from "react"

type Props = {
  onChange: (text: string) => void
  label?: string
  errorMessage?: string | null
}

export default function SharedSeedInput(props: Props): ReactElement {
  const { onChange, label = "", errorMessage = null } = props
  const [seed, setSeed] = useState("")

  useEffect(() => {
    onChange(seed)
  }, [seed, onChange])

  return (
    <>
      <div className="input_wrap">
        <div
          id="recovery_phrase"
          role="textbox"
          aria-labelledby="recovery_label"
          tabIndex={0}
          contentEditable
          data-empty={seed.length < 1}
          spellCheck="false"
          onPaste={(e) => {
            e.preventDefault()
            const text = e.clipboardData.getData("text/plain").trim()
            e.currentTarget.innerText = text
            setSeed(text)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const text = e.dataTransfer.getData("text/plain").trim()
            e.currentTarget.innerText = text
            setSeed(text)
          }}
          onInput={(e) => {
            setSeed(e.currentTarget.innerText.trim())
          }}
        />
        <div id="recovery_label" className="recovery_label">
          {label}
        </div>
        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>
      <style jsx>{`
        .input_wrap {
          position: relative;
        }

        .recovery_label {
          position: absolute;
          font-size: 12px;
          line-height: 16px;
          transition: all 0.2s ease-in-out;
          pointer-events: none;
        }

        #recovery_phrase[data-empty="true"]:not(:focus) ~ .recovery_label {
          font-size: 16px;
          line-height: 24px;
          top: 12px;
          left: 16px;
        }

        #recovery_phrase[data-empty="false"] ~ .recovery_label {
          padding: 0 6px;
          color: var(--green-40);
          background: var(--hunter-green);
          top: -8px;
          left: 16px;
        }

        #recovery_phrase {
          width: 320px;
          height: 104px;
          border-radius: 4px;
          border: 2px solid var(--green-60);
          padding: 12px 16px;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: var(--white);
          font-family: inherit;
          overflow-y: scroll;
        }

        #recovery_phrase * {
          word-wrap: break-word;
          color: var(--white);
          font-family: inherit;
        }

        #recovery_phrase:focus ~ .recovery_label {
          top: -8px;
          left: 16px;
          padding: 0 6px;
          color: var(--trophy-gold);
          background: var(--hunter-green);
          transition: all 0.2s ease-in-out;
          z-index: var(--z-menu);
        }

        #recovery_phrase:focus {
          border: 2px solid var(--trophy-gold);
          outline: 0;
          background: var(--hunter-green);
        }

        .error {
          color: red;
        }
      `}</style>
    </>
  )
}
