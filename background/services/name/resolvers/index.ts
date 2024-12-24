import ensResolverFor from "./ens"
import addressBookResolverFor from "./address-book"
import knownContractResolverFor from "./known-contracts"
import unsResolver from "./uns"
import rnsResolver from "./rns"
import idrissResolver from "./idriss"

const resolvers = {
  ensResolverFor,
  addressBookResolverFor,
  knownContractResolverFor,
  unsResolver,
  rnsResolver,
  idrissResolver,
}

type ResolverConstructors = ReturnType<
  (typeof resolvers)[keyof typeof resolvers]
>

export type NameResolverSystem = ResolverConstructors["type"]

export {
  ensResolverFor,
  addressBookResolverFor,
  knownContractResolverFor,
  unsResolver,
  rnsResolver,
  idrissResolver,
}
