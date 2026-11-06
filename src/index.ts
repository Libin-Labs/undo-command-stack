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

export function createCommandStack(limit = 1000): CommandStack {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000)
    throw new RangeError('Limit must be an integer from 1 to 1000000.');
  const history: Command[] = [];
  let cursor = 0;
  let busy = false;
  let tail: Promise<void> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(async () => {
      busy = true;
      try {
        return await operation();
      } finally {
        busy = false;
      }
    });
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const run = async (command: Command) => {
    try {
      await command.execute();
    } catch (error) {
      if (command.compensateFailedExecute) {
        try {
          await command.compensateFailedExecute();
        } catch (compensationError) {
          throw new AggregateError(
            [error, compensationError],
            'Command execution and compensation both failed.',
          );
        }
      }
      throw error;
    }
  };
  return {
    execute(command) {
      if (
        !command ||
        typeof command.execute !== 'function' ||
        typeof command.undo !== 'function' ||
        (command.compensateFailedExecute !== undefined &&
          typeof command.compensateFailedExecute !== 'function')
      )
        return Promise.reject(new TypeError('Command requires execute and undo functions.'));
      return enqueue(async () => {
        await run(command);
        history.splice(cursor);
        history.push(command);
        cursor = history.length;
        if (history.length > limit) {
          history.shift();
          cursor -= 1;
        }
      });
    },
    undo() {
      return enqueue(async () => {
        if (cursor === 0) return false;
        const command = history[cursor - 1]!;
        await command.undo();
        cursor -= 1;
        return true;
      });
    },
    redo() {
      return enqueue(async () => {
        if (cursor === history.length) return false;
        const command = history[cursor]!;
        await run(command);
        cursor += 1;
        return true;
      });
    },
    clear() {
      return enqueue(async () => {
        history.length = 0;
        cursor = 0;
      });
    },
    snapshot() {
      return Object.freeze({ undoCount: cursor, redoCount: history.length - cursor, busy });
    },
  };
}
