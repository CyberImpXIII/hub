'use strict';
// The origin stamp (PLAN-hub.md §3, §11 "a rebuild is never read as Jacob's prompt";
// fixed point 4): a turn is `jacob` only when the prompt that started it is one the
// user-prompt hook recorded as typed; everything else is `model`. The server
// computes it; a sender's own `origin` is discarded before this runs.
//
// What a transcript gives: the prompt that started the final turn, the last `user`
// line whose message content is a string (a tool result is a `user` line too, with
// a list for content). What the hub's own records give: for that session, the
// prompts the hook recorded, each with its hash, whether the hub itself had
// delivered that text to the session (a relay, so `model`) and the ctx: id the store
// returned. Neither is trusted alone: the transcript names the turn, the record
// says who typed it. No transcript at hand (a fixture, a sender that passed none):
// the session's latest record decides.

const fs = require('node:fs');
const crypto = require('node:crypto');

function promptHash(text) { return crypto.createHash('sha256').update(String(text).replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16); }

// The text of the prompt that started the last turn of a transcript, or null.
function lastPrompt(transcriptPath) {
  let text;
  try { text = fs.readFileSync(transcriptPath, 'utf8'); } catch { return null; }
  let last = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (j && j.type === 'user' && j.message && typeof j.message.content === 'string') last = j.message.content;
  }
  return last;
}

// {origin: 'jacob'|'model', origin_id, hash, why} from the session's prompt records
// (newest last) and, when given, the transcript's last prompt.
function classify(records, transcriptPath) {
  const prompt = transcriptPath ? lastPrompt(transcriptPath) : null;
  if (prompt !== null) {
    const h = promptHash(prompt);
    const rec = [...records].reverse().find((r) => r.hash === h);
    if (!rec) return { origin: 'model', origin_id: null, hash: h, why: 'the turn\'s prompt was never recorded by the user-prompt hook' };
    if (rec.typed === false) return { origin: 'model', origin_id: null, hash: h, why: 'the turn\'s prompt is a message the hub delivered to this session' };
    return { origin: 'jacob', origin_id: rec.ctx_id || null, hash: h, why: 'the turn\'s prompt is one Jacob typed, by the user-prompt hook\'s record' };
  }
  const rec = records.length ? records[records.length - 1] : null;
  if (!rec) return { origin: 'model', origin_id: null, hash: null, why: 'no prompt recorded for this session' };
  if (rec.typed === false) return { origin: 'model', origin_id: null, hash: rec.hash, why: 'the latest prompt is a message the hub delivered to this session' };
  return { origin: 'jacob', origin_id: rec.ctx_id || null, hash: rec.hash, why: 'the latest recorded prompt is one Jacob typed (no transcript to name the turn)' };
}

module.exports = { promptHash, lastPrompt, classify };
