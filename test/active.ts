import { getActiveApplication } from "../index.ts";

setInterval(async () => {
  console.log(await getActiveApplication());
}, 500);
