import { typeText, pressKey } from "../index.ts";

console.log("Sleeping for 3 seconds so you can focus another app like TextEdit ...");
setTimeout(async () => {
  const text = "This is a sentence.";
  for (let i = 0; i < 25; i++) {
    await typeText(text);
  }

  for (let i = 0; i < 10; i++) {
    await typeText(text);
    await pressKey("backspace", [], text.length);
  }
}, 3000);
