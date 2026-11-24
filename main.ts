import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

// One sentence, chosen against the judge's brief in its order: it pitches
// a product that sounds real (a premium subscription app with its own
// crypto token), a founder who sounds certain (your sleep apnea deserved
// a market cap), and a function nobody on earth needs (minting and trading
// your snoring with strangers); it is specific (a token called $ZZZ, traded
// with other snorers), funny on the first read, and perfectly pointless.
// The bounty requires one sentence of at most 240 characters: fail loudly
// instead of writing an entry the judge would refuse.
// The gate is strict on purpose — the entry file must be exactly this one
// sentence, byte for byte: no carriage return (a second kind of line break),
// no leading or trailing padding (the judge reads the file as submitted),
// and no control characters (including U+2028 and U+2029, which look like
// line breaks to a reader but not to a naive newline check).
const text =
  "SnoreBank is a premium subscription app that records your snoring, mints it into a crypto token called $ZZZ, and lets you trade it with other snorers — because your sleep apnea deserved a market cap.";

const codePoints = [...text].length;
if (codePoints < 1 || codePoints > 240 || text.trim().length === 0) {
  throw new Error(
    `entry must be 1-240 characters of non-blank text, got ${codePoints}`,
  );
}
if (text.includes("\n") || text.includes("\r")) {
  throw new Error("entry must be a single line");
}
if (text.includes("\u2028") || text.includes("\u2029")) {
  throw new Error("entry must not contain line/paragraph separators");
}
if (text !== text.trim()) {
  throw new Error("entry must not start or end with whitespace");
}
// One sentence: exactly one sentence-ending period, at the very end.
// A second sentence would make it a pitch deck, not a pitch.
if (!text.endsWith(".") || (text.match(/\./g) ?? []).length !== 1) {
  throw new Error("entry must be exactly one sentence");
}
if (/[?!]/.test(text)) {
  throw new Error("entry must not contain other sentence-ending punctuation");
}
// A byte-order mark or zero-width character would be read as part of the
// line without ever being seen, and would change the entry's byte length
// against its character count: reject them alongside the control set.
if (/[\u0000-\u001f\u007f\ufeff\u200b-\u200d]/.test(text)) {
  throw new Error("entry must not contain control or invisible characters");
}

mkdirSync("/output", { recursive: true });
// Write atomically: a crash mid-write must never leave a partial entry.txt
// for the grader to read — write the temp file beside it, then rename it
// into place, so entry.txt is always the whole sentence or nothing.
const tmpPath = "/output/.entry.txt.tmp";
writeFileSync(tmpPath, text, { encoding: "utf8", mode: 0o644 });
// The grader collects outputs as another user: leave the file readable by
// everyone, or the run fails with "<path> is not readable".
chmodSync(tmpPath, 0o644);
renameSync(tmpPath, "/output/entry.txt");

// Read it back and prove the file on disk is exactly the sentence: a write
// that silently truncated, re-encoded or padded the entry would otherwise
// ship a different text to the judge than the one gated above.
const written = readFileSync("/output/entry.txt", "utf8");
if (written !== text) {
  throw new Error("entry file does not match the gated sentence");
}
// The file must end exactly at the last character: a trailing newline
// would make the entry two lines to a reader that counts lines, and the
// equality check above would already have caught it — this asserts the
// invariant on its own so a future edit that relaxes the write cannot
// silently reintroduce it.
if (written.endsWith("\n") || written.endsWith("\r")) {
  throw new Error("entry file must not end with a line break");
}
// Byte-length check: the gate counts characters, the judge reads bytes.
// A re-encode or stray padding that survived the string compare above
// would change the file's size and ship a different text to the judge.
if (Buffer.byteLength(written, "utf8") !== Buffer.byteLength(text, "utf8")) {
  throw new Error("entry file byte length does not match the gated sentence");
}
