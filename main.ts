import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

// One sentence, chosen against the judge's brief in its order: it pitches
// a product that sounds real (a premium subscription app with its own
// crypto token), a founder who sounds certain (your sleep apnea deserved
// a market cap), and a function nobody on earth needs (minting and trading
// your snoring with strangers); it is specific (a token called $ZZZ, traded
// with other snorers), funny on the first read, and perfectly pointless.
const text =
  "SnoreBank is a premium subscription app that records your snoring, mints it into a crypto token called $ZZZ, and lets you trade it with other snorers — because your sleep apnea deserved a market cap.";

const MAX_CHARS = 240;
const OUT_PATH = "/output/entry.txt";
const TMP_PATH = "/output/.entry.txt.tmp";

// The bounty requires one sentence of at most 240 characters: fail loudly
// instead of writing an entry the judge would refuse.
// The gate is strict on purpose — the entry file must be exactly this one
// sentence, byte for byte: no carriage return (a second kind of line break),
// no leading or trailing padding (the judge reads the file as submitted),
// and no control characters (including U+2028 and U+2029, which look like
// line breaks to a reader but not to a naive newline check).
function validateEntry(line: string): void {
  const codePoints = [...line].length;
  if (codePoints < 1 || codePoints > MAX_CHARS || line.trim().length === 0) {
    throw new Error(
      `entry must be 1-${MAX_CHARS} characters of non-blank text, got ${codePoints}`,
    );
  }
  if (line.includes("\n") || line.includes("\r")) {
    throw new Error("entry must be a single line");
  }
  if (line.includes("\u2028") || line.includes("\u2029")) {
    throw new Error("entry must not contain line/paragraph separators");
  }
  if (line !== line.trim()) {
    throw new Error("entry must not start or end with whitespace");
  }
  // One sentence: exactly one sentence-ending period, at the very end.
  // A second sentence would make it a pitch deck, not a pitch.
  if (!line.endsWith(".") || (line.match(/\./g) ?? []).length !== 1) {
    throw new Error("entry must be exactly one sentence");
  }
  if (/[?!]/.test(line)) {
    throw new Error("entry must not contain other sentence-ending punctuation");
  }
  // A byte-order mark or zero-width character would be read as part of the
  // line without ever being seen, and would change the entry's byte length
  // against its character count: reject them alongside the control set.
  // A non-breaking space is invisible padding of the same kind, and a lone
  // surrogate would not survive a UTF-8 round trip, so both are refused
  // here rather than shipping a sentence the judge reads differently.
  if (/[\u0000-\u001f\u007f\u00a0\ufeff\u200b-\u200d]/.test(line)) {
    throw new Error("entry must not contain control or invisible characters");
  }
  if (/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(line)) {
    throw new Error("entry must not contain lone surrogates");
  }
}

// Write atomically: a crash mid-write must never leave a partial entry.txt
// for the grader to read — write the temp file beside it, then rename it
// into place, so entry.txt is always the whole sentence or nothing. The
// temp file is created world-readable (mode 0644) because the grader
// collects outputs as another user, and the rename keeps that mode.
function writeEntryAtomic(line: string): void {
  mkdirSync("/output", { recursive: true });
  writeFileSync(TMP_PATH, line, { encoding: "utf8", mode: 0o644 });
  chmodSync(TMP_PATH, 0o644);
  renameSync(TMP_PATH, OUT_PATH);

  // Read it back and prove the file on disk is exactly the sentence: a
  // write that silently truncated, re-encoded or padded the entry would
  // otherwise ship a different text to the judge than the one gated above.
  const written = readFileSync(OUT_PATH, "utf8");
  if (written !== line) {
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
  if (Buffer.byteLength(written, "utf8") !== Buffer.byteLength(line, "utf8")) {
    throw new Error("entry file byte length does not match the gated sentence");
  }
}

function main(): void {
  validateEntry(text);
  writeEntryAtomic(text);
  console.log(`wrote ${[...text].length} chars to ${OUT_PATH}`);
  console.log(text);
}

main();
