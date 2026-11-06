# @lp-labs/undo-command-stack

Serialized asynchronous command history. FIFO-serialized asynchronous command execute/undo/redo with explicit failure compensation and bounded history.

## Install

```sh
npm install @lp-labs/undo-command-stack
```

## Quick start

```js
import { createCommandStack } from '@lp-labs/undo-command-stack';
const stack = createCommandStack();
const value = { count: 0 };
await stack.execute({
  execute() {
    value.count += 1;
  },
  undo() {
    value.count -= 1;
  },
});
console.log(value.count); // 1
```

## Runtime exports

- `createCommandStack`

The package supplies independent ESM and CommonJS builds, bundled declarations, and no runtime or peer dependencies.

## Complete public TypeScript declarations

```ts
export interface Command {
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
  compensateFailedExecute?(): void | Promise<void>;
}
export interface CommandStackSnapshot {
  readonly undoCount: number;
  readonly redoCount: number;
  readonly busy: boolean;
}
export interface CommandStack {
  execute(command: Command): Promise<void>;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  clear(): Promise<void>;
  snapshot(): CommandStackSnapshot;
}
export declare function createCommandStack(limit?: number): CommandStack;
```

## Scope and limits

Executes real commands, retains undo/redo history, serializes operations in submission order, truncates redo branches after a new command, and bounds retained history.

## Errors and bounds

Invalid limits raise RangeError; missing execute/undo methods reject with TypeError. Command failures are never swallowed; snapshot reports committed undo/redo counts and current busy state.

## Customization

Commands own their state changes and should make execute/undo atomic or implement compensation for partial execute failures. Undo partial side effects cannot be inferred or automatically compensated. Do not have a command await another operation on the same stack: FIFO serialization would deadlock. Clear is serialized like other operations.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
