import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandStack } from '../dist/esm/index.js';

function command(change, amount = 1) {
  return {
    execute() {
      change.value += amount;
    },
    undo() {
      change.value -= amount;
    },
  };
}
test('executes, undoes, and redoes actual command effects', async () => {
  const state = { value: 0 };
  const stack = createCommandStack();
  await stack.execute(command(state, 3));
  assert.equal(state.value, 3);
  assert.equal(await stack.undo(), true);
  assert.equal(state.value, 0);
  assert.equal(await stack.redo(), true);
  assert.equal(state.value, 3);
});
test('serializes concurrent command submissions in call order', async () => {
  const state = { value: 0 };
  const stack = createCommandStack();
  const order = [];
  await Promise.all(
    [1, 2, 3].map((n) =>
      stack.execute({
        async execute() {
          await new Promise((resolve) => setTimeout(resolve, 2));
          order.push(n);
          state.value += n;
        },
        undo() {
          state.value -= n;
        },
      }),
    ),
  );
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(state.value, 6);
});
test('compensates a failed execute and does not add it to history', async () => {
  const state = { value: 0 };
  const stack = createCommandStack();
  await assert.rejects(
    stack.execute({
      execute() {
        state.value = 1;
        throw new Error('partial');
      },
      compensateFailedExecute() {
        state.value = 0;
      },
      undo() {
        state.value = 0;
      },
    }),
    /partial/,
  );
  assert.equal(state.value, 0);
  assert.deepEqual(stack.snapshot(), { undoCount: 0, redoCount: 0, busy: false });
});
test('preserves the original asynchronous execute rejection and keeps history unchanged', async () => {
  const stack = createCommandStack();
  const failure = new Error('async command failed');
  await assert.rejects(
    stack.execute({
      async execute() {
        await Promise.resolve();
        throw failure;
      },
      undo() {},
    }),
    (error) => error === failure,
  );
  assert.deepEqual(stack.snapshot(), { undoCount: 0, redoCount: 0, busy: false });
});
test('preserves the history cursor when undo fails', async () => {
  const stack = createCommandStack();
  const failure = new Error('undo failed');
  await stack.execute({
    execute() {},
    async undo() {
      await Promise.resolve();
      throw failure;
    },
  });
  await assert.rejects(stack.undo(), (error) => error === failure);
  assert.deepEqual(stack.snapshot(), { undoCount: 1, redoCount: 0, busy: false });
});
test('new execution after undo removes the old redo branch', async () => {
  const state = { value: 0 };
  const stack = createCommandStack();
  await stack.execute(command(state, 1));
  await stack.execute(command(state, 2));
  await stack.undo();
  await stack.execute(command(state, 5));
  assert.equal(state.value, 6);
  assert.equal(await stack.redo(), false);
});
test('bounds retained history and rejects invalid commands/limits', async () => {
  const state = { value: 0 };
  const stack = createCommandStack(1);
  await stack.execute(command(state));
  await stack.execute(command(state));
  assert.deepEqual(stack.snapshot(), { undoCount: 1, redoCount: 0, busy: false });
  await assert.rejects(stack.execute({ execute() {} }), TypeError);
  assert.throws(() => createCommandStack(0), RangeError);
});
