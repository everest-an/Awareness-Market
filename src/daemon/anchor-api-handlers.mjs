// F-088 · REST surface for ERC-8350 anchoring. Decoupled sub-module, same pattern
// as telemetry-api-handlers.mjs. All routes are no-ops (404-ish JSON) when the
// feature is disabled — the daemon never fails because of anchoring.

import {confirmSeq} from './anchoring/anchor-state.mjs';

function json(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 64 * 1024) reject(new Error('body too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function handleAnchorRoute(daemon, req, res, route) {
  const mgr = daemon.anchoring;
  if (!mgr) {
    return json(res, 200, {enabled: false, hint: 'set anchoring.enabled=true in .awareness/config.json and restart'});
  }

  try {
    if (route === '/anchor/status' && req.method === 'GET') {
      return json(res, 200, mgr.status());
    }

    if (route === '/anchor/outbox' && req.method === 'GET') {
      return json(res, 200, {pending: mgr.outbox()});
    }

    // F-088 P3 · per-card anchor state for UI badges: card_id → {seq, status, tx}
    if (route === '/anchor/cards' && req.method === 'GET') {
      const rows = mgr.db.prepare(
        `SELECT s.card_id, s.built_seq AS seq, COALESCE(o.status, 'pending') AS status, o.tx_hash
         FROM anchor_state s LEFT JOIN anchor_outbox o ON o.seq = s.built_seq`
      ).all();
      const cards = {};
      for (const r of rows) cards[r.card_id] = {seq: r.seq, status: r.status, tx: r.tx_hash || null};
      return json(res, 200, {cards});
    }

    if (route === '/anchor/confirm' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const seq = Number(body.seq);
      const txHash = String(body.tx_hash || '');
      if (!Number.isInteger(seq) || seq < 1 || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        return json(res, 400, {error: 'expected {seq: int >= 1, tx_hash: 0x…64}'});
      }
      const ok = confirmSeq(mgr.db, seq, txHash);
      return ok
        ? json(res, 200, {confirmed: seq, tx_hash: txHash})
        : json(res, 409, {error: `seq ${seq} is not pending`});
    }

    return json(res, 404, {error: `unknown anchor route: ${route}`});
  } catch (err) {
    return json(res, 500, {error: err.message});
  }
}
