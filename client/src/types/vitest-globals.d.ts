// Global type shim: bridge jest-style Mock/Mocked/... type names to vitest equivalents.
// Used so the mechanical sed-rename from `jest.Mock` -> `Mock` etc. during the
// vitest migration (PR-11) keeps test files compiling without forcing an
// `import { Mock } from "vitest"` into every test file.
//
// vitest exposes these names as type members of the `vitest` package, but unlike
// `@types/jest` it does NOT add them to the global namespace. This shim adds
// them back as globals so the rename is purely mechanical.

import type {
  Mock as ViMock,
  Mocked as ViMocked,
  MockedFunction as ViMockedFunction,
  MockedClass as ViMockedClass,
  MockedObject as ViMockedObject,
  MockInstance as ViMockInstance
} from "vitest"

declare global {
  type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> = ViMock<T>
  type Mocked<T> = ViMocked<T>
  type MockedFunction<T extends (...args: any[]) => any> = ViMockedFunction<T>
  type MockedClass<T extends abstract new (...args: any[]) => any> = ViMockedClass<T>
  type MockedObject<T> = ViMockedObject<T>
  type MockInstance<T extends (...args: any[]) => any = (...args: any[]) => any> =
    ViMockInstance<T>
}

export {}
