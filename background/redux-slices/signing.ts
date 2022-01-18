import { TypedDataField } from "@ethersproject/abstract-signer"
import { createSelector, createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { BigNumber } from "ethers"
import { getEthereumNetwork } from "../lib/utils"
import { HexString } from "../types"
import { createBackgroundAsyncThunk } from "./utils"

export type TypedData = {
  domain: EIP712DomainType
  types: Record<string, TypedDataField[]>
  message: Record<string, unknown>
  primaryType: string
}

export type Events = {
  requestSignTypedData: {
    typedData: TypedData
    account: HexString
  }
}

export const signingSliceEmitter = new Emittery<Events>()

export type SigningState = {
  signedTypedData: string | undefined
  typedDataRequest: SignTypedDataRequest | undefined
}

export const initialState: SigningState = {
  typedDataRequest: undefined,
  signedTypedData: undefined,
}

export type EIP712DomainType = {
  name?: string
  version?: string
  chainId?: number
  verifyingContract?: HexString
}

export type PermitRequest = {
  account: HexString
  liquidityTokenAddress: HexString
  liquidityAmount: BigNumber
  nonce: BigNumber
  deadline: BigNumber
  spender: HexString
}

export type SignTypedDataRequest = {
  account: string
  typedData: TypedData
}

export const signTypedData = createBackgroundAsyncThunk(
  "signing/signTypedData",
  async (data: SignTypedDataRequest) => {
    const { account, typedData } = data
    // what am I getting here, where domain, where types, message, very sad
    await signingSliceEmitter.emit("requestSignTypedData", {
      typedData,
      account,
    })
  }
)

const signingSlice = createSlice({
  name: "signing",
  initialState,
  reducers: {
    signedTypedData: (state, { payload }: { payload: string }) => ({
      ...state,
      signedTypedData: payload,
    }),
    typedDataRequest: (
      state,
      { payload }: { payload: SignTypedDataRequest }
    ) => ({
      ...state,
      typedDataRequest: payload,
    }),
  },
})

export const { signedTypedData, typedDataRequest } = signingSlice.actions

export default signingSlice.reducer

export const selectTypedData = createSelector(
  (state: { signing: SigningState }) => state.signing.typedDataRequest,
  (signTypes) => signTypes
)
