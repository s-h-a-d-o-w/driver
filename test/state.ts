import { getEditorState } from "../index.ts";

setInterval(async () => {
  const state = await getEditorState();
  const { cursor, text } = state;
  console.log(state);
  console.log(text.slice(0, cursor) + "<>" + text.slice(cursor));
}, 500);
