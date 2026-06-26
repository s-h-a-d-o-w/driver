import { getMouseLocation, click } from "../index.ts";

setInterval(async () => {
  const mouseLocation = await getMouseLocation();
  console.log(mouseLocation);
}, 500);
setInterval(async () => {
  await click();
}, 2000);
