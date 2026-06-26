import {
  click,
  getActiveApplication,
  getInstalledApplications,
  getMouseLocation,
  getRunningApplications,
  launchApplication,
  mouseDown,
  mouseUp,
  pressKey,
  quitApplication,
  runShell,
  setMouseLocation,
  typeText,
} from "../index.ts";

const run = async () => {
  console.log("Active application:", await getActiveApplication());
  console.log(
    "Running applications:",
    (await getRunningApplications()).slice(0, 5),
  );
  console.log(
    "Installed applications:",
    (await getInstalledApplications()).slice(0, 5),
  );
  console.log("Mouse location:", await getMouseLocation());

  console.log("Running a command");
  console.log(await runShell("ls", ["-lah"]));

  console.log(String.raw`Typing "My password is Password123!\n"`);
  await typeText("My password is Password123!\n");

  console.log("Pressing backspace 14 times");
  await pressKey("backspace", [], 14);

  console.log(String.raw`Typing "a\nb\n"`);
  await typeText("a\nb\n");

  console.log("Pressing c");
  await pressKey("c");

  console.log("NOT pressing backspace");
  await pressKey("backspace", [], 0);

  const menuLocation =
    process.platform === "darwin"
      ? [140, 10]
      : process.platform === "linux"
        ? [80, 65]
        : [20, 20];

  console.log("Pressing menu");
  await setMouseLocation(menuLocation[0], menuLocation[1]);
  await mouseDown();
  setTimeout(async () => {
    await mouseUp();

    if (process.platform === "darwin") {
      console.log("Pressing command+tab");
      await pressKey("tab", ["command"]);
      console.log("Launching calculator...");
      await launchApplication("calc");

      setTimeout(async () => {
        console.log("Quitting calculator...");
        await quitApplication("calc");
      }, 1000);

      return;
    }

    if (process.platform === "linux") {
      console.log("Pressing alt+tab");
      await pressKey("tab", ["alt"]);

      console.log("Double clicking");
      await click("left", 2);

      return;
    }

    setTimeout(async () => {
      console.log("Pressing alt+tab");
      await pressKey("tab", ["alt"]);

      console.log("Double clicking");
      await click("left", 2);
    }, 100);
  }, 1000);
};

console.log(
  "Sleeping for 3 seconds so you can focus another app like TextEdit ...",
);
setTimeout(() => run(), 3000);
