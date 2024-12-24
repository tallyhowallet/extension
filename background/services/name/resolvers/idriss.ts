import { IdrissCrypto } from "idriss-crypto/lib/browser"
import { AddressOnNetwork, NameOnNetwork } from "../../../accounts"
import { ETHEREUM, MINUTE, POLYGON, BINANCE_SMART_CHAIN, ARBITRUM_ONE, OPTIMISM, ZK_SYNC } from "../../../constants"
import { isDefined } from "../../../lib/utils/type-guards"
import { sameNetwork } from "../../../networks"
import { NameResolver } from "../name-resolver"
import { normalizeEVMAddress } from "../../../lib/utils"


const IDRISS_SUPPORTED_NETWORKS = [ETHEREUM, POLYGON, BINANCE_SMART_CHAIN, ARBITRUM_ONE, OPTIMISM, ZK_SYNC]


export default function idrissResolver(): NameResolver<"idriss"> {
  return {
    type: "idriss",
    canAttemptNameResolution(): boolean {
      return true
    },
    canAttemptAvatarResolution(): boolean {
      return false
    },
    canAttemptAddressResolution({ name, network }: NameOnNetwork): boolean {
      return (
        IdrissCrypto.matchInput(name) !== null &&
        IDRISS_SUPPORTED_NETWORKS.some((supportedNetwork) =>
          sameNetwork(network, supportedNetwork),
        )
      )
    },

    async lookUpAddressForName({
      name,
      network,
    }: NameOnNetwork): Promise<AddressOnNetwork | undefined> {
      const resolver = new IdrissCrypto()
      const result = await resolver.resolve(name, { network: "evm" })
      const address = result["Public ETH"] ?? Object.values(result)[0]
      if (address) {
        const normalizedAddress = normalizeEVMAddress(address)
        return { address: normalizedAddress, network }
      }
      return undefined
    },
    async lookUpAvatar(
      addressOrNameOnNetwork: AddressOnNetwork | NameOnNetwork,
    ) {
      return undefined
    },
    async lookUpNameForAddress({
      address,
      network,
    }: AddressOnNetwork): Promise<NameOnNetwork | undefined> {
      const resolver = new IdrissCrypto()
      const result = await resolver.reverseResolve(address)
      if (result) {
        return { name: result, network }
      }
      return undefined
    },
  }
}
