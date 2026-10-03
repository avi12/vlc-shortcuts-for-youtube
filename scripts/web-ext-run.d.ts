declare module "web-ext-run" {
  interface ExtensionRunner {
    reloadAllExtensions: () => Promise<void>;
    exit: () => Promise<void>;
    registerCleanup: (cleanupCallback: () => void) => void;
  }

  interface RunCommand {
    run: (options: Record<string, unknown>, config?: { shouldExitProgram?: boolean }) => Promise<ExtensionRunner>;
  }

  const webExtRun: {
    cmd: { run: RunCommand["run"] };
  };
  export default webExtRun;
}

declare module "web-ext-run/util/logger" {
  interface ConsoleStream {
    write: (entry: {
      level: number;
      msg: string;
      name?: string;
      time?: string;
    }) => void;
  }
  export const consoleStream: ConsoleStream;
}
