import sinon from "sinon"
import InternalEthereumProviderService from ".."
import { EVMNetwork } from "../../../networks"

import {
  createChainService,
  createInternalEthereumProviderService,
} from "../../../tests/factories"

describe("Internal Ethereum Provider Service", () => {
  const sandbox = sinon.createSandbox()
  let IEPService: InternalEthereumProviderService

  beforeEach(async () => {
    sandbox.restore()
    IEPService = await createInternalEthereumProviderService()
    await IEPService.startService()
  })

  afterEach(async () => {
    await IEPService.stopService()
  })

  it("should correctly persist chains sent in via wallet_addEthereumChain", async () => {
    const chainService = createChainService()

    IEPService = await createInternalEthereumProviderService({ chainService })
    const startedChainService = await chainService
    await startedChainService.startService()
    await IEPService.startService()
    const METHOD = "wallet_addEthereumChain"
    const ORIGIN = "https://chainlist.org"

    // prettier-ignore
    const EIP3085_PARAMS = [ { chainId: "0xfa", chainName: "Fantom Opera", nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18, }, rpcUrls: [ "https://fantom-mainnet.gateway.pokt.network/v1/lb/62759259ea1b320039c9e7ac", "https://rpc.ftm.tools", "https://rpc.ankr.com/fantom", "https://rpc.fantom.network", "https://rpc2.fantom.network", "https://rpc3.fantom.network", "https://rpcapi.fantom.network", "https://fantom-mainnet.public.blastapi.io", "https://1rpc.io/ftm", ], blockExplorerUrls: ["https://ftmscan.com"], }, "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", ]

    await IEPService.routeSafeRPCRequest(METHOD, EIP3085_PARAMS, ORIGIN)

    expect(
      startedChainService.supportedNetworks.find(
        (network: EVMNetwork) => network.name === "Fantom Opera"
      )
    ).toBeTruthy()
  })
})
