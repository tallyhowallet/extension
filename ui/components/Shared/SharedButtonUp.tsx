import classNames from "classnames"
import React, {
  ReactElement,
  RefObject,
  useCallback,
  useEffect,
  useState,
} from "react"

export default function SharedButtonUp<T extends HTMLElement>(props: {
  elementRef: RefObject<T>
  offset?: number
}): ReactElement {
  const { elementRef, offset = 0 } = props
  const [isHidden, setIsHidden] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      const { y } = elementRef.current?.getBoundingClientRect() ?? {}

      if (typeof y !== "undefined") setIsHidden(y + offset > 0)
    }, 500)

    return () => clearInterval(id)
  }, [elementRef, offset])

  const scrollToTop = useCallback(
    () =>
      elementRef.current?.scrollIntoView({
        behavior: "smooth",
      }),
    [elementRef],
  )

  return (
    <>
      <button
        type="button"
        className={classNames("button_up", {
          hidden: isHidden,
        })}
        onClick={scrollToTop}
      >
        <div className="icon_up" />
      </button>
      <style jsx>{`
        .button_up {
          position: absolute;
          bottom: 68px;
          right: 8px;
          margin-left: auto;
          width: 32px;
          height: 32px;
          background-color: var(--green-20);
          border-radius: 9px;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: var(--z-expnaded);
          opacity: 1;
          transition: opacity 100ms ease-in;
        }
        .button_up.hidden {
          opacity: 0;
          pointer-events: none;
        }
        .button_up:hover {
          background-color: var(--white);
        }
        .icon_up {
          mask-image: url("./images/chevron_down.svg");
          mask-size: 14px 8px;
          mask-repeat: no-repeat;
          width: 14px;
          height: 8px;
          background-color: var(--hunter-green);
          transform: rotate(180deg);
        }
      `}</style>
    </>
  )
}
