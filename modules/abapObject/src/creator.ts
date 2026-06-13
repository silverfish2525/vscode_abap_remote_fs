import { AbapObjectBase, type AbapObjectConstructor, type AbapObject } from "./AbapObject"
import type { AbapObjectService } from "./AOService"
import type { Node } from "abap-adt-api"
import { AbapObjectError } from "./AOError"
// NOTE: a side-effect import of "./objectTypes" used to live here. It was
// effectively dead — tsc strips empty imports and ts-jest inherited that —
// but esbuild (vitest's transformer) preserves it, which creates a circular
// load order: creator -> objectTypes -> AbapClass -> creator (partial). All
// call sites that need the constructors Map populated already import
// `./objectTypes` (or its re-export from `.`) explicitly, so removing this
// is safe under jest, vitest, and the production build.

const constructors = new Map<string, AbapObjectConstructor>()
export const AbapObjectCreator =
  (...types: string[]) =>
  (target: AbapObjectConstructor) => {
    for (const t of types) {
      if (constructors.has(t)) throw new Error(`Conflict assigning constructor for type ${t}`)
      constructors.set(t, target)
    }
  }

export const create = (
  type: string,
  name: string,
  path: string,
  expandable: boolean,
  techName: string,
  parent: AbapObject | undefined,
  sapguiUri: string,
  client: AbapObjectService,
  owner = ""
) => {
  if (!type || !path)
    throw new AbapObjectError(
      "Invalid",
      undefined,
      "Abap Object can't be created without a type and path"
    )
  const cons = constructors.get(type) || AbapObjectBase
  return new cons(type, name, path, expandable, techName, parent, sapguiUri, client, owner)
}

export const fromNode = (node: Node, parent: AbapObject | undefined, client: AbapObjectService) =>
  create(
    node.OBJECT_TYPE,
    node.OBJECT_NAME,
    node.OBJECT_URI,
    !!node.EXPANDABLE,
    node.TECH_NAME,
    parent,
    node.OBJECT_VIT_URI,
    client
  )
