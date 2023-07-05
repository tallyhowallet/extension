import { createSlice } from "@reduxjs/toolkit"
import type { RootState } from "."
import { ETHEREUM } from "../constants"
import { EIP1559Block, AnyEVMBlock, EVMNetwork } from "../networks"
import { removeChainBalances } from "./accounts"
import { selectCurrentNetwork } from "./selectors/uiSelectors"
import { setSelectedNetwork } from "./ui"
import { createBackgroundAsyncThunk } from "./utils"
import { ValidatedAddEthereumChainParameter } from "../services/provider-bridge/utils"

type NetworkState = {
  blockHeight: number | null
  baseFeePerGas: bigint | null
}

export type NetworksState = {
  evmNetworks: {
    [chainID: string]: EVMNetwork
  }
  blockInfo: {
    [chainID: string]: NetworkState
  }
}

export const initialState: NetworksState = {
  evmNetworks: {},
  blockInfo: {
    "1": {
      blockHeight: null,
      baseFeePerGas: null,
    },
  },
}

const networksSlice = createSlice({
  name: "networks",
  initialState,
  reducers: {
    blockSeen: (
      immerState,
      { payload: blockPayload }: { payload: AnyEVMBlock }
    ) => {
      const block = blockPayload as EIP1559Block

      if (!(block.network.chainID in immerState.blockInfo)) {
        immerState.blockInfo[block.network.chainID] = {
          blockHeight: block.blockHeight,
          baseFeePerGas: block?.baseFeePerGas ?? null,
        }
      } else if (
        block.blockHeight >
        (immerState.blockInfo[block.network.chainID].blockHeight || 0)
      ) {
        immerState.blockInfo[block.network.chainID].blockHeight =
          block.blockHeight
        immerState.blockInfo[block.network.chainID].baseFeePerGas =
          block?.baseFeePerGas ?? null
      }
    },
    /**
     * Receives all supported networks as the payload
     */
    setEVMNetworks: (immerState, { payload }: { payload: EVMNetwork[] }) => {
      const chainIds = payload.map((network) => network.chainID)

      payload.forEach((network) => {
        immerState.evmNetworks[network.chainID] = network
      })

      // Remove payload missing networks from state
      Object.keys(immerState.evmNetworks).forEach((chainID) => {
        if (!chainIds.includes(chainID)) {
          delete immerState.evmNetworks[chainID]
          delete immerState.blockInfo[chainID]
        }
      })
    },
  },
})

export const { blockSeen, setEVMNetworks } = networksSlice.actions

export default networksSlice.reducer

export const removeCustomChain = createBackgroundAsyncThunk(
  "networks/removeCustomChain",
  async (chainID: string, { getState, dispatch, extra: { main } }) => {
    const store = getState() as RootState
    const currentNetwork = selectCurrentNetwork(store)

    if (currentNetwork.chainID === chainID) {
      await dispatch(setSelectedNetwork(ETHEREUM))
    }
    await dispatch(removeChainBalances(chainID))

    return main.removeEVMNetwork(chainID)
  }
)

export const addCustomChain = createBackgroundAsyncThunk(
  "networks/addCustomChain",
  async (
    [network]: [ValidatedAddEthereumChainParameter],
    { extra: { main } }
  ) => {
    return main.addCustomNetwork(network)
  }
)
