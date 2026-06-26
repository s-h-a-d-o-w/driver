import { getEditorState } from "../index.ts";

setInterval(async () => {
  const state = await getEditorState();
  const text = state.text;
  const cursor = state.cursor;
  console.log(state);
  console.log(
    text.substring(0, cursor) + "<>" + text.substring(cursor, text.length),
  );
}, 500);
