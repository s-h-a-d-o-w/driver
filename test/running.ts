import { getRunningApplications } from "../index.ts";

setInterval(async () => {
  console.log(await getRunningApplications());
}, 500);
