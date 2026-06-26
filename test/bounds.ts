import { getActiveApplicationWindowBounds } from "../index.ts";

setInterval(async () => {
  const bounds = await getActiveApplicationWindowBounds();
  console.log(bounds);
}, 500);
