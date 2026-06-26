import { focusApplication } from "../index.ts";

await focusApplication(process.argv[2], {
  terminal: "term",
  vscode: "code",
  "visual studio code": "code",
});
