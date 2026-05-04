export type ChatMessageSegment =
  | { type: "text"; text: string }
  | { type: "movie"; title: string; url: string }
  | { type: "link"; url: string };

const MOVIE_PAIR_RE = /«([^»]+)»\s+(https?:\/\/[^\s<>"']+)/gi;
const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

function pushTextWithUrls(chunk: string, out: ChatMessageSegment[]): void {
  if (!chunk) return;
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(chunk)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", text: chunk.slice(last, m.index) });
    }
    out.push({ type: "link", url: m[1] });
    last = m.index + m[0].length;
  }
  if (last < chunk.length) {
    out.push({ type: "text", text: chunk.slice(last) });
  }
}

export function parseChatMessageContent(text: string): ChatMessageSegment[] {
  if (!text) return [];

  const segments: ChatMessageSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  MOVIE_PAIR_RE.lastIndex = 0;
  while ((m = MOVIE_PAIR_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      pushTextWithUrls(text.slice(lastIndex, m.index), segments);
    }
    segments.push({ type: "movie", title: m[1], url: m[2] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    pushTextWithUrls(text.slice(lastIndex), segments);
  }

  return mergeAdjacentText(segments);
}

function mergeAdjacentText(
  segments: ChatMessageSegment[],
): ChatMessageSegment[] {
  const out: ChatMessageSegment[] = [];
  for (const s of segments) {
    if (s.type === "text" && !s.text) continue;
    const prev = out[out.length - 1];
    if (s.type === "text" && prev?.type === "text") {
      prev.text += s.text;
    } else {
      out.push(s);
    }
  }
  return out;
}
