import {
  AnyEVMBlock,
  AnyEVMTransaction,
  EVMLog,
  EVMNetwork,
  isEIP1559TransactionRequest,
} from "../../networks"
import {
  SmartContractFungibleAsset,
  isSmartContractFungibleAsset,
  AnyAsset,
} from "../../assets"
import { enrichAssetAmountWithDecimalValues } from "../../redux-slices/utils/asset-utils"

import { normalizeEVMAddress, sameEVMAddress } from "../../lib/utils"

import ChainService from "../chain"
import IndexingService from "../indexing"
import NameService from "../name"
import {
  TransactionAnnotation,
  PartialTransactionRequestWithFrom,
  EnrichedEVMTransactionRequest,
  EnrichedAddressOnNetwork,
} from "./types"
import {
  getDistinctRecipentAddressesFromERC20Logs,
  getERC20LogsForAddresses,
} from "./utils"
import { enrichAddressOnNetwork } from "./addresses"
import { OPTIMISM } from "../../constants"
import { parseLogsForWrappedDepositsAndWithdrawals } from "../../lib/wrappedAsset"
import {
  ERC20TransferLog,
  parseERC20Tx,
  parseLogsForERC20Transfers,
} from "../../lib/erc20"
import { isDefined, isFulfilledPromise } from "../../lib/utils/type-guards"
import { unsignedTransactionFromEVMTransaction } from "../chain/utils"

async function buildSubannotations(
  chainService: ChainService,
  nameService: NameService,
  relevantTransferLogs: ERC20TransferLog[],
  assets: AnyAsset[],
  addressEnrichmentsByAddress: {
    [k: string]: EnrichedAddressOnNetwork
  },
  network: EVMNetwork,
  desiredDecimals: number,
  resolvedTime: number,
  block: AnyEVMBlock | undefined,
) {
  const subannotations = (
    await Promise.allSettled(
      relevantTransferLogs.map(
        async ({
          contractAddress,
          amount,
          senderAddress,
          recipientAddress,
        }) => {
          // See if the address matches a fungible asset.
          const matchingFungibleAsset = assets.find(
            (asset): asset is SmartContractFungibleAsset =>
              isSmartContractFungibleAsset(asset) &&
              sameEVMAddress(asset.contractAddress, contractAddress),
          )

          if (!matchingFungibleAsset) {
            return undefined
          }

          // Try to find a resolved annotation for the recipient and sender and otherwise fetch them
          const recipient =
            addressEnrichmentsByAddress[
              normalizeEVMAddress(recipientAddress)
            ] ??
            (await enrichAddressOnNetwork(chainService, nameService, {
              address: recipientAddress,
              network,
            }))
          const sender =
            addressEnrichmentsByAddress[normalizeEVMAddress(senderAddress)] ??
            (await enrichAddressOnNetwork(chainService, nameService, {
              address: senderAddress,
              network,
            }))

          return {
            type: "asset-transfer" as const,
            assetAmount: enrichAssetAmountWithDecimalValues(
              {
                asset: matchingFungibleAsset,
                amount,
              },
              desiredDecimals,
            ),
            sender,
            recipient,
            timestamp: resolvedTime,
            blockTimestamp: block?.timestamp,
          }
        },
      ),
    )
  )
    .filter(isFulfilledPromise)
    .map(({ value }) => value)
    .filter(isDefined)

  return subannotations
}

export async function annotationsFromLogs(
  chainService: ChainService,
  indexingService: IndexingService,
  nameService: NameService,
  logs: EVMLog[],
  network: EVMNetwork,
  desiredDecimals: number,
  resolvedTime: number,
  block: AnyEVMBlock | undefined,
): Promise<TransactionAnnotation[]> {
  const assets = indexingService.getCachedAssets(network)

  const accountAddresses = (await chainService.getAccountsToTrack()).map(
    (account) => account.address,
  )

  const tokenTransferLogs = [
    ...parseLogsForERC20Transfers(logs),
    ...parseLogsForWrappedDepositsAndWithdrawals(logs),
  ]

  const relevantTransferLogs = getERC20LogsForAddresses(
    tokenTransferLogs,
    accountAddresses,
  )

  const relevantAddresses =
    getDistinctRecipentAddressesFromERC20Logs(relevantTransferLogs).map(
      normalizeEVMAddress,
    )

  // Look up transfer log names, then flatten to an address -> name map.
  const addressEnrichmentsByAddress = Object.fromEntries(
    (
      await Promise.allSettled(
        relevantAddresses.map(
          async (address) =>
            [
              address,
              await enrichAddressOnNetwork(chainService, nameService, {
                address,
                network,
              }),
            ] as const,
        ),
      )
    )
      .filter(isFulfilledPromise)
      .map(({ value }) => value)
      .filter(([, annotation]) => isDefined(annotation)),
  )

  const subannotations = await buildSubannotations(
    chainService,
    nameService,
    relevantTransferLogs,
    assets,
    addressEnrichmentsByAddress,
    network,
    desiredDecimals,
    resolvedTime,
    block,
  )

  return subannotations
}

/**
 * Resolve an annotation for a partial transaction request, or a pending
 * or mined transaction.
 */
export default async function resolveTransactionAnnotation(
  chainService: ChainService,
  indexingService: IndexingService,
  nameService: NameService,
  network: EVMNetwork,
  transaction:
    | AnyEVMTransaction
    | (PartialTransactionRequestWithFrom & {
        blockHash?: string
      })
    | (EnrichedEVMTransactionRequest & {
        blockHash?: string
      }),
  desiredDecimals: number,
): Promise<TransactionAnnotation> {
  const assets = await indexingService.getCachedAssets(network)

  // By default, annotate all requests as contract interactions, unless they
  // already carry additional metadata.
  let txAnnotation: TransactionAnnotation =
    "annotation" in transaction && transaction.annotation !== undefined
      ? transaction.annotation
      : {
          blockTimestamp: undefined,
          timestamp: Date.now(),
          type: "contract-deployment",
          transactionLogoURL: assets.find(
            (asset) =>
              asset.metadata?.logoURL &&
              asset.symbol === transaction.network.baseAsset.symbol,
          )?.metadata?.logoURL,
        }

  let block: AnyEVMBlock | undefined

  const {
    assetAmount: { amount: baseAssetBalance },
  } = await chainService.getLatestBaseAccountBalance({
    address: transaction.from,
    network,
  })

  const { gasLimit, blockHash } = transaction

  const additionalL1Gas =
    network.chainID === OPTIMISM.chainID
      ? await chainService.estimateL1RollupFeeForOptimism(
          network,
          unsignedTransactionFromEVMTransaction(transaction),
        )
      : 0n

  const gasFee: bigint = isEIP1559TransactionRequest(transaction)
    ? (transaction?.maxFeePerGas ?? 0n) * (gasLimit ?? 0n) + additionalL1Gas
    : (("gasPrice" in transaction && transaction?.gasPrice) || 0n) *
        (gasLimit ?? 0n) +
      additionalL1Gas

  txAnnotation.warnings ??= []

  // If the wallet doesn't have enough base asset to cover gas, push a warning
  if (gasFee + (transaction.value ?? 0n) > baseAssetBalance) {
    if (!txAnnotation.warnings.includes("insufficient-funds")) {
      txAnnotation.warnings.push("insufficient-funds")
    }
  }

  // If the transaction has been mined, get the block and set the timestamp
  if (blockHash) {
    block = await chainService.getBlockData(network, blockHash)
    txAnnotation = {
      ...txAnnotation,
      blockTimestamp: block?.timestamp,
    }
  }

  // If the tx has a recipient, its a contract interaction or another tx type
  // rather than a deployment.
  if (typeof transaction.to !== "undefined") {
    const contractInfo = await enrichAddressOnNetwork(
      chainService,
      nameService,
      {
        address: transaction.to,
        network,
      },
    )

    txAnnotation =
      txAnnotation.type === "contract-deployment"
        ? {
            ...txAnnotation,
            type: "contract-interaction",
            contractInfo: await enrichAddressOnNetwork(
              chainService,
              nameService,
              {
                address: transaction.to,
                network,
              },
            ),
          }
        : // Don't replace prepopulated annotations.
          txAnnotation

    // For prepopulated swap annotations, resolve the swap contract info.
    if (txAnnotation.type === "asset-swap") {
      txAnnotation = {
        ...txAnnotation,
        swapContractInfo: contractInfo,
      }
    }

    if (
      transaction.input === null ||
      transaction.input === "0x" ||
      typeof transaction.input === "undefined"
    ) {
      // If the tx has no data, it's either a simple ETH send, or it's relying
      // on a contract that's `payable` to execute code

      const recipient = contractInfo
      const sender = await enrichAddressOnNetwork(chainService, nameService, {
        address: transaction.from,
        network,
      })

      // This is _almost certainly_ not a contract interaction, move on. Note that
      // a simple ETH send to a contract address can still effectively be a
      // contract interaction (because it calls the fallback function on the
      // contract), but for now we deliberately ignore that scenario when
      // categorizing activities.
      // TODO We can do more here by checking how much gas was spent. Anything
      // over the 21k required to send ETH is a more complex contract interaction
      if (typeof transaction.value !== "undefined") {
        // Warn if we're sending ETH to a contract. This is normal if you're
        // funding a multisig or exchange, but it's good to double check
        // If the annotation is a built-in contract or in the address book,
        // skip the warning.
        if (
          recipient.annotation.hasCode &&
          !(
            recipient.annotation.nameRecord?.system ===
              "tally-known-contracts" ||
            recipient.annotation.nameRecord?.system === "tally-address-book"
          )
        ) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("send-to-contract")
        }

        txAnnotation = {
          ...txAnnotation,
          type: "asset-transfer",
          sender,
          recipient,
          assetAmount: enrichAssetAmountWithDecimalValues(
            {
              asset: network.baseAsset,
              amount: transaction.value,
            },
            desiredDecimals,
          ),
        }
      }
    } else {
      const erc20Tx = parseERC20Tx(transaction.input)

      // See if the address matches a fungible asset.
      const matchingFungibleAsset = assets.find(
        (asset): asset is SmartContractFungibleAsset =>
          isSmartContractFungibleAsset(asset) &&
          sameEVMAddress(asset.contractAddress, transaction.to),
      )

      const transactionLogoURL = matchingFungibleAsset?.metadata?.logoURL

      // TODO handle the case where we don't have asset metadata already
      if (
        matchingFungibleAsset &&
        erc20Tx &&
        (erc20Tx.name === "transfer" || erc20Tx.name === "transferFrom")
      ) {
        const [sender, recipient] = await Promise.all([
          enrichAddressOnNetwork(chainService, nameService, {
            address: erc20Tx.args.from ?? transaction.from,
            network,
          }),
          enrichAddressOnNetwork(chainService, nameService, {
            address: erc20Tx.args.to,
            network,
          }),
        ])

        // We have an ERC-20 transfer
        txAnnotation = {
          ...txAnnotation,
          type: "asset-transfer",
          transactionLogoURL,
          sender,
          recipient,
          assetAmount: enrichAssetAmountWithDecimalValues(
            {
              asset: matchingFungibleAsset,
              amount: BigInt(erc20Tx.args.amount),
            },
            desiredDecimals,
          ),
        }
        // Warn if we're sending the token to its own contract
        if (sameEVMAddress(erc20Tx.args.to, transaction.to)) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("send-to-token")
        }
        // Warn if we're sending the token to a contract. This is normal if
        // you're funding a multisig or exchange, but it's good to double check.
        // If the annotation is a built-in contract or in the address book,
        // skip the warning.
        if (
          recipient.annotation.hasCode &&
          !(
            recipient.annotation.nameRecord?.system ===
              "tally-known-contracts" ||
            recipient.annotation.nameRecord?.system === "tally-address-book"
          )
        ) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("send-to-contract")
        }
      } else if (
        matchingFungibleAsset &&
        erc20Tx &&
        erc20Tx.name === "approve"
      ) {
        const spender = await enrichAddressOnNetwork(
          chainService,
          nameService,
          {
            address: erc20Tx.args.spender,
            network,
          },
        )
        // Warn if we're approving spending to a likely EOA. Note this will also
        // sweep up CREATE2 contracts that haven't yet been deployed
        if (!spender.annotation.hasCode) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("approve-eoa")
        }
        txAnnotation = {
          ...txAnnotation,
          type: "asset-approval",
          transactionLogoURL,
          spender,
          assetAmount: enrichAssetAmountWithDecimalValues(
            {
              asset: matchingFungibleAsset,
              amount: BigInt(erc20Tx.args.value),
            },
            desiredDecimals,
          ),
        }
      }
    }
  }

  // Look up logs and resolve subannotations, if available.
  if ("logs" in transaction && typeof transaction.logs !== "undefined") {
    const subannotations = await annotationsFromLogs(
      chainService,
      indexingService,
      nameService,
      transaction.logs,
      network,
      desiredDecimals,
      txAnnotation.timestamp,
      block,
    )

    if (subannotations.length > 0) {
      txAnnotation.subannotations = subannotations
    }
  }

  return txAnnotation
}
