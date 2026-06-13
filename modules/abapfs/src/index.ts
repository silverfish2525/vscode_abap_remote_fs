export { createRoot, Root, isRoot } from "./root"
export * from "./folder"
export * from "./abapFolder"
export * from "./abapFile"
export * from "./AFsService"
// Surface the lock primitives so consumers don't reach into the compiled
// `abapfs/out/lockObject` and `abapfs/out/lockManager` paths — those deep
// imports couple consumers to the build layout (and break test loaders that
// resolve `abapfs` to the TS source).
export { ReloginError } from "./lockManager"
export type { LockStatus } from "./lockObject"
