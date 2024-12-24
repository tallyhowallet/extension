import { HexString, UNIXTime } from "../../types"
import { normalizeAddressOnNetwork } from "../../lib/utils"
import { getTokenMetadata } from "../../lib/erc721"
import { storageGatewayURL } from "../../lib/storage-gateway"

import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService from "../base"
import ChainService from "../chain"
import logger from "../../lib/logger"
import { AddressOnNetwork, NameOnNetwork } from "../../accounts"
import { SECOND } from "../../constants"

import { NameResolver } from "./name-resolver"
import {
  NameResolverSystem,
  knownContractResolverFor,
  addressBookResolverFor,
  ensResolverFor,
  unsResolver,
  rnsResolver,
  idrissResolver,
} from "./resolvers"
import PreferenceService from "../preferences"
import { isFulfilledPromise } from "../../lib/utils/type-guards"

export { NameResolverSystem }

export type ResolvedAddressRecord = {
  from: NameOnNetwork
  resolved: {
    addressOnNetwork: AddressOnNetwork
  }
  system: NameResolverSystem
}

export type ResolvedNameRecord = {
  from: {
    addressOnNetwork: AddressOnNetwork
  }
  resolved: {
    nameOnNetwork: NameOnNetwork
    expiresAt: UNIXTime
  }
  system: NameResolverSystem
}

type ResolvedAvatarRecord = {
  from: {
    addressOnNetwork: AddressOnNetwork
  }
  resolved: {
    avatar: URL
  }
  system: NameResolverSystem
}

type Events = ServiceLifecycleEvents & {
  resolvedAddress: ResolvedAddressRecord
  resolvedName: ResolvedNameRecord
  resolvedAvatar: ResolvedAvatarRecord
}

// A minimum record expiry that avoids infinite resolution loops.
const MINIMUM_RECORD_EXPIRY = 10 * SECOND

/**
 * The NameService is responsible for resolving human-readable names into
 * addresses and other metadata across multiple networks, caching where
 * appropriate.
 *
 * Initially, the service supports ENS on mainnet Ethereum.
 */
export default class NameService extends BaseService<Events> {
  private resolvers: NameResolver<NameResolverSystem>[] = []

  /**
   * Cached resolution for avatar URIs that are not yet URLs, e.g. for EIP155.
   */
  private cachedResolvedEIP155Avatars: Record<
    string,
    ResolvedAvatarRecord | undefined
  > = {}

  /**
   * Cached resolution for name records, by network family followed by whatever
   * discrimant might be used within a network family between networks.
   */
  private cachedResolvedNames: {
    EVM: {
      [chainID: string]: {
        [address: HexString]: ResolvedNameRecord | undefined
      }
    }
  } = {
    EVM: {},
  }

  /**
   * Create a new NameService. The service isn't initialized until
   * startService() is called and resolved.
   *
   * @param chainService - Required for chain interactions.
   * @returns A new, initializing ChainService
   */
  static create: ServiceCreatorFunction<
    Events,
    NameService,
    [Promise<ChainService>, Promise<PreferenceService>]
  > = async (chainService, preferenceService) =>
    new this(await chainService, await preferenceService)

  private constructor(
    private chainService: ChainService,
    preferenceService: PreferenceService,
  ) {
    super({})

    this.resolvers = [
      // User-controlled resolvers are higher priority.
      addressBookResolverFor(preferenceService),
      knownContractResolverFor(preferenceService),
      // Third-party resolvers are used when the user has not defined a name
      // for the given resource.
      ensResolverFor(chainService),
      unsResolver(),
      rnsResolver(),
      idrissResolver(),
    ]

    preferenceService.emitter.on(
      "addressBookEntryModified",
      async ({ network, address }) => {
        this.clearNameCacheEntry(network.chainID, address)
        await this.lookUpName({ network, address })
      },
    )

    chainService.emitter.on("newAccountToTrack", async (addressOnNetwork) => {
      try {
        await this.lookUpName(addressOnNetwork)
      } catch (error) {
        logger.error("Error fetching name for address", addressOnNetwork, error)
      }
    })
    this.emitter.on("resolvedName", async ({ from: { addressOnNetwork } }) => {
      try {
        const avatar = await this.lookUpAvatar(addressOnNetwork)

        if (avatar) {
          this.emitter.emit("resolvedAvatar", avatar)
        }
      } catch (error) {
        logger.error(
          "Error fetching avatar for address",
          addressOnNetwork,
          error,
        )
      }
    })
  }

  async lookUpEthereumAddress(
    nameOnNetwork: NameOnNetwork,
  ): Promise<ResolvedAddressRecord | undefined> {
    const workingResolvers = this.resolvers.filter((resolver) =>
      resolver.canAttemptAddressResolution(nameOnNetwork),
    )

    const firstMatchingResolution = (
      await Promise.allSettled(
        workingResolvers.map(async (resolver) => ({
          type: resolver.type,
          resolved: await resolver.lookUpAddressForName(nameOnNetwork),
        })),
      )
    )
      .filter(isFulfilledPromise)
      .find(({ value: { resolved } }) => resolved !== undefined)?.value

    if (
      firstMatchingResolution === undefined ||
      firstMatchingResolution.resolved === undefined
    ) {
      return undefined
    }

    const { type: resolverType, resolved: addressOnNetwork } =
      firstMatchingResolution

    // TODO cache name resolution and TTL
    const normalizedAddressOnNetwork =
      normalizeAddressOnNetwork(addressOnNetwork)

    const resolvedRecord = {
      from: nameOnNetwork,
      resolved: { addressOnNetwork: normalizedAddressOnNetwork },
      system: resolverType,
    }
    this.emitter.emit("resolvedAddress", resolvedRecord)

    return resolvedRecord
  }

  async lookUpName(
    addressOnNetwork: AddressOnNetwork,
    checkCache = true,
  ): Promise<ResolvedNameRecord | undefined> {
    const { address, network } = normalizeAddressOnNetwork(addressOnNetwork)

    if (!this.cachedResolvedNames[network.family][network.chainID]) {
      this.cachedResolvedNames[network.family][network.chainID] = {}
    }

    const cachedResolvedNameRecord =
      this.cachedResolvedNames[network.family]?.[network.chainID]?.[address]

    if (checkCache && cachedResolvedNameRecord) {
      const {
        resolved: { expiresAt },
      } = cachedResolvedNameRecord

      if (expiresAt >= Date.now()) {
        return cachedResolvedNameRecord
      }
    }

    const workingResolvers = this.resolvers.filter((resolver) =>
      resolver.canAttemptNameResolution({ address, network }),
    )

    const localResolvers = [...workingResolvers].filter(
      (resolver) =>
        resolver.type === "tally-address-book" ||
        resolver.type === "tally-known-contracts",
    )
    const remoteResolvers = [...workingResolvers].filter(
      (resolver) =>
        resolver.type !== "tally-address-book" &&
        resolver.type !== "tally-known-contracts",
    )

    let firstMatchingResolution = (
      await Promise.allSettled(
        localResolvers.map(async (resolver) => ({
          type: resolver.type,
          resolved: await resolver.lookUpNameForAddress({ address, network }),
        })),
      )
    )
      .filter(isFulfilledPromise)
      .find(({ value: { resolved } }) => resolved !== undefined)?.value

    if (!firstMatchingResolution) {
      firstMatchingResolution = (
        await Promise.allSettled(
          remoteResolvers.map(async (resolver) => ({
            type: resolver.type,
            resolved: await resolver.lookUpNameForAddress({ address, network }),
          })),
        )
      )
        .filter(isFulfilledPromise)
        .find(({ value: { resolved } }) => resolved !== undefined)?.value
    }

    if (
      firstMatchingResolution === undefined ||
      firstMatchingResolution.resolved === undefined
    ) {
      return undefined
    }

    const { type: resolverType, resolved: nameOnNetwork } =
      firstMatchingResolution

    const nameRecord = {
      from: { addressOnNetwork: { address, network } },
      resolved: {
        nameOnNetwork,
        // TODO Read this from the name service; for now, this avoids infinite
        // TODO resolution loops.
        expiresAt: Date.now() + MINIMUM_RECORD_EXPIRY,
      },
      system: resolverType,
    } as const

    const cachedNameOnNetwork = cachedResolvedNameRecord?.resolved.nameOnNetwork

    this.cachedResolvedNames[network.family][network.chainID][address] =
      nameRecord

    // Only emit an event if the resolved name changed.
    if (cachedNameOnNetwork?.name !== nameOnNetwork.name) {
      this.emitter.emit("resolvedName", nameRecord)
    }

    return nameRecord
  }

  clearNameCacheEntry(chainId: string, address: HexString): void {
    if (this.cachedResolvedNames.EVM[chainId]?.[address] !== undefined) {
      delete this.cachedResolvedNames.EVM[chainId][address]
    }
  }

  removeAccount(address: HexString): void {
    const chainIds = Object.keys(this.cachedResolvedNames.EVM)

    chainIds.forEach((chainId) => {
      this.clearNameCacheEntry(chainId, address)
    })
  }

  async lookUpAvatar(
    addressOnNetwork: AddressOnNetwork,
  ): Promise<ResolvedAvatarRecord | undefined> {
    const workingResolvers = this.resolvers.filter((resolver) =>
      resolver.canAttemptAvatarResolution(addressOnNetwork),
    )

    const firstMatchingResolution = (
      await Promise.allSettled(
        workingResolvers.map(async (resolver) => ({
          type: resolver.type,
          resolved: await resolver.lookUpAvatar(addressOnNetwork),
        })),
      )
    )
      .filter(isFulfilledPromise)
      .find(({ value: { resolved } }) => resolved !== undefined)?.value

    if (
      firstMatchingResolution === undefined ||
      firstMatchingResolution.resolved === undefined
    ) {
      return undefined
    }

    const {
      type: resolverType,
      resolved: { uri: avatarUri },
    } = firstMatchingResolution

    const baseResolvedAvatar = {
      from: { addressOnNetwork },
      system: resolverType,
    }

    if (avatarUri instanceof URL) {
      return {
        ...baseResolvedAvatar,
        resolved: { avatar: storageGatewayURL(avatarUri.href) },
      }
    }

    if (avatarUri.match(/^eip155:1\/erc721:/)) {
      const normalizedAvatarUri = avatarUri.toLowerCase()
      // check if we've cached the resolved URL, otherwise hit the chain
      if (normalizedAvatarUri in this.cachedResolvedEIP155Avatars) {
        // TODO properly cache this with any other non-ENS NFT stuff we do
        return this.cachedResolvedEIP155Avatars[normalizedAvatarUri]
      }

      const provider = this.chainService.providerForNetwork(
        addressOnNetwork.network,
      )

      // these URIs look like eip155:1/erc721:0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6/2430
      // check the spec for more details https://gist.github.com/Arachnid/9db60bd75277969ee1689c8742b75182
      const [, , , erc721Address, nftID] = avatarUri.split(/[:/]/)
      if (
        provider !== undefined &&
        erc721Address !== undefined &&
        nftID !== undefined
      ) {
        const metadata = await getTokenMetadata(
          provider,
          erc721Address,
          BigInt(nftID),
        )

        if (metadata !== undefined && metadata.image !== undefined) {
          const { image } = metadata
          const resolvedGateway = {
            ...baseResolvedAvatar,
            resolved: { avatar: storageGatewayURL(image) },
          }

          this.cachedResolvedEIP155Avatars[normalizedAvatarUri] =
            resolvedGateway
          return resolvedGateway
        }
      }
    }

    // If not an EIP URI, assume we're looking at a standard URL; if that
    // fails, log an error and just return undefined.
    try {
      const plainURL = storageGatewayURL(avatarUri)
      return {
        ...baseResolvedAvatar,
        resolved: { avatar: plainURL },
      }
    } catch (error) {
      logger.error("Unexpected avatar URI scheme", avatarUri)
      return undefined
    }
  }
}
// TODO resolve content, eg IPFS hashes
