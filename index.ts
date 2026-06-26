import * as childProcess from "node:child_process";
import bindings from "bindings";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as shortcut from "windows-shortcuts";

type ApplicationAliases = Record<string, string>;

type EditorState = {
  cursor: number;
  error: boolean;
  text: string;
};

const lib = bindings("serenade-driver.node") as {
  click: (button: string, count: number) => Promise<void>;
  clickButton: (button: string, count: number) => Promise<void>;
  focusApplication: (application: string) => Promise<void>;
  getActiveApplication: () => Promise<string>;
  getActiveApplicationWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
  getClickableButtons: () => Promise<string[]>;
  getEditorState: () => Promise<EditorState>;
  getEditorStateFallback: (paragraph: boolean) => Promise<EditorState>;
  getMouseLocation: () => Promise<{ x: number; y: number }>;
  getRunningApplications: () => Promise<string[]>;
  mouseDown: (button: string) => Promise<void>;
  mouseUp: (button: string) => Promise<void>;
  pressKey: (key: string, modifiers: string[], count: number) => Promise<void>;
  setEditorState: (text: string, cursor: number, cursorEnd: number) => Promise<void>;
  setMouseLocation: (x: number, y: number) => Promise<void>;
  typeText: (text: string) => Promise<void>;
};

function applicationMatches(application: string, possible: string[], aliases?: ApplicationAliases) {
  let alias = application;
  if (aliases && aliases[application]) {
    alias = normalizeApplication(aliases[application]);
  }

  return possible.filter((e) => {
    const possibility = normalizeApplication(e);
    return possibility.includes(application) || possibility.includes(alias);
  });
}

function normalizeApplication(s: string) {
  return s.toLowerCase().replace(/ /g, "");
}

export function click(button = "left", count?: number | false) {
  if (count === undefined || count === false) {
    count = 1;
  }

  if (count < 1) {
    return;
  }

  return lib.click(button, count);
}

export function clickButton(button: string, count?: number | false) {
  return click(button, count);
}

export function delay(timeout: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

export async function focusApplication(application: string, aliases?: ApplicationAliases) {
  let normalizedApplication = normalizeApplication(application);

  // if we have an exact match without any aliasing, then prioritize that
  if (applicationMatches(normalizedApplication, await getRunningApplications(), {}).length > 0) {
    return lib.focusApplication(normalizedApplication);
  }

  // otherwise, try to focus using the alias map
  if (aliases && aliases[normalizedApplication]) {
    normalizedApplication = normalizeApplication(aliases[normalizedApplication]);
  }

  return lib.focusApplication(normalizedApplication);
}

export async function focusOrLaunchApplication(application: string, aliases?: ApplicationAliases) {
  const normalizedApplication = normalizeApplication(application);
  const running = await getRunningApplications();

  // if we have an exact match or an aliased match, then we want to focus instead of launching
  const matching =
    applicationMatches(normalizedApplication, running, aliases).length > 0 ||
    applicationMatches(normalizedApplication, running, {}).length > 0;

  if (!matching) {
    return launchApplication(normalizedApplication, aliases);
  } else {
    return focusApplication(normalizedApplication, aliases);
  }
}

export function getActiveApplication() {
  return lib.getActiveApplication();
}

export function getActiveApplicationWindowBounds() {
  return lib.getActiveApplicationWindowBounds();
}

export function getClickableButtons() {
  return lib.getClickableButtons();
}

export function getEditorState() {
  return lib.getEditorState();
}

export function getEditorStateFallback(paragraph?: boolean) {
  return lib.getEditorStateFallback(!!paragraph);
}

export async function getInstalledApplications() {
  async function search(root: string, depth: number, max: number) {
    let result: string[] = [];
    if (depth === max) {
      return result;
    }

    return new Promise<string[]>((resolve) => {
      fs.readdir(root, { withFileTypes: true }, async (error, files) => {
        if (!error && files && files.length) {
          for (let e of files) {
            const file = path.join(root, e.name);
            if (os.platform() === "darwin" && file.endsWith(".app")) {
              result.push(file);
            } else if (os.platform() === "win32" && file.endsWith(".lnk")) {
              result.push(file);
            } else if (e.isDirectory()) {
              result = result.concat(await search(file, depth + 1, max));
            }
          }
        }

        resolve(result);
      });
    });
  }

  const max = 2;
  if (os.platform() === "darwin") {
    return (await search("/Applications", 0, max)).concat(
      await search("/System/Applications", 0, max)
    );
  } else if (os.platform() === "win32") {
    return (await search(path.join(os.homedir(), "Desktop"), 0, max))
      .concat(
        await search(
          path.join(process.env.APPDATA!, "Microsoft", "Windows", "Start Menu", "Programs"),
          0,
          max
        )
      )
      .concat(await search("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", 0, max));
  }

  return [];
}

export function getMouseLocation() {
  return lib.getMouseLocation();
}

export function getRunningApplications() {
  return lib.getRunningApplications() as string[] | Promise<string[]>;
}

export async function launchApplication(application: string, aliases?: ApplicationAliases) {
  if (os.platform() === "linux") {
    childProcess.spawn(application, [], { detached: true });
    return;
  }

  const normalizedApplication = normalizeApplication(application);
  const matching = applicationMatches(
    normalizedApplication,
    await getInstalledApplications(),
    aliases
  );

  if (matching.length == 0) {
    return;
  }

  if (os.platform() === "darwin") {
    childProcess.spawn("open", [matching[0]], { detached: true });
  } else if (os.platform() === "win32") {
    const app = matching[0];
    if (app.endsWith(".lnk")) {
      shortcut.query(app, (error, data) => {
        if (error) {
          return;
        }

        let args: string[] = [];
        if (data?.args) {
          args = [data.args.replace(/"/g, "")];
        }

        const options: childProcess.SpawnOptions = { detached: true };
        if (data?.workingDir) {
          options.cwd = data.workingDir;
        }

        childProcess.spawn(path.basename(data?.target || ""), args, options);
      });
    } else {
      childProcess.spawn(app, [], { detached: true });
    }
  }
}

export function mouseDown(button = "left") {
  return lib.mouseDown(button);
}

export function mouseUp(button = "left") {
  return lib.mouseUp(button);
}

export function pressKey(key: string, modifiers: string[] = [], count?: number | false) {
  if (count === undefined || count === false) {
    count = 1;
  }

  if (count < 1) {
    return;
  }

  return lib.pressKey(key, modifiers, count);
}

export async function quitApplication(application?: string, aliases?: ApplicationAliases) {
  if (!application) {
    return;
  }

  if (applicationMatches(application, await getRunningApplications(), aliases).length == 0) {
    return;
  }

  let modifiers = ["alt"];
  let key = "f4";
  if (os.platform() == "darwin") {
    modifiers = ["command"];
    key = "q";
  }

  await lib.focusApplication(application);
  await delay(100);
  return lib.pressKey(key, modifiers, 1);
}

export async function runShell(
  command: string,
  args: string[],
  options: childProcess.SpawnOptions = {}
) {
  let stdout = "";
  let stderr = "";

  const spawned = childProcess.spawn(command, args, options);

  spawned.stdout?.on("data", (data) => {
    stdout += data;
  });

  spawned.stderr?.on("data", (data) => {
    stderr += data;
  });

  return new Promise<{
    stderr: string;
    stdout: string;
  }>((resolve) => {
    spawned.on("close", () => {
      resolve({ stdout, stderr });
    });
  });
}

export function setEditorState(text: string, cursor: number, cursorEnd = 0) {
  return lib.setEditorState(text, cursor, cursorEnd);
}

export function setMouseLocation(x: number, y: number) {
  return lib.setMouseLocation(x, y);
}

export function typeText(text?: string) {
  if (!text) {
    return;
  }

  return lib.typeText(text);
}
