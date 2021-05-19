import React from 'react';

export default function TopMenuProtocolSwitcher() {
  return (
    <>
      <div className="wrap">
        Ethereum
        <div className="icon_chevron_down" />
      </div>
      <style jsx>
        {`
          .wrap {
            color: #99a8a7;
            display: flex;
            align-items: center;
            cursor: pointer;
          }
          .icon_chevron_down {
            background: url('/assets/img/chevron_down.svg');
            background-size: 15px 8px;
            width: 15px;
            height: 8px;
            margin-left: 7px;
            margin-top: 2px;
          }
        `}
      </style>
    </>
  );
}
