/** Memory-bounded snapshot transport. Reads only; never deletes or alters stored analytics. */
export const SNAPSHOT_TABLES = [
  ['events','wi_events','timestamp','event_id',25000,true],
  ['leads','wi_leads','last_seen','id',10000,false],
  ['configurations','wi_configurations','created_at','id',10000,false],
  ['visitors','wi_visitors','last_seen','id',10000,false],
  ['sessions','wi_sessions','start_time','id',10000,false],
  ['configuratorSessions','wi_configurator_sessions','last_step_at','id',10000,false],
  ['pageViews','wi_page_views','timestamp','id',10000,false],
  ['attribution','wi_attribution','timestamp','id',10000,false],
  ['arrivals','wi_arrivals','timestamp','arrival_id',10000,false],
];
const q = values => new URLSearchParams(values).toString();
const quoted = value => '"' + String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';
const encoder = new TextEncoder();
const FAILURE = 'Reporting data changed or could not be loaded. Please refresh.';

// Keep only IDs and sort keys in memory. Keyset pagination avoids duplicates
// when new visits arrive while a report is being read.
async function manifest(db, table, timeKey, idKey, maximum, cancelled) {
  const rows = []; const seen = new Set(); let total = null; let cursor = null;
  while (rows.length < maximum) {
    if (cancelled()) throw new Error('Report cancelled.');
    const take = Math.min(1000, maximum - rows.length);
    const params = {select: `${idKey},${timeKey}`, order: `${timeKey}.desc,${idKey}.desc`, limit: String(take)};
    if (cursor) {
      const id = quoted(cursor[idKey]);
      params.or = cursor[timeKey] == null
        ? `(and(${timeKey}.is.null,${idKey}.lt.${id}),${timeKey}.not.is.null)`
        : `(${timeKey}.lt.${quoted(cursor[timeKey])},and(${timeKey}.eq.${quoted(cursor[timeKey])},${idKey}.lt.${id}))`;
    }
    const result = await db(`${table}?${q(params)}`, cursor ? {} : {headers:{Prefer:'count:exact'}});
    if (!Array.isArray(result.data)) throw new Error(FAILURE);
    if (total === null && Number.isSafeInteger(result.count) && result.count >= 0) total = result.count;
    const chunk = result.data;
    for (const row of chunk) {
      if (!row || typeof row[idKey] !== 'string' || seen.has(row[idKey])) throw new Error(FAILURE);
      seen.add(row[idKey]); rows.push(row);
    }
    if (chunk.length < take) { if (total === null) total = rows.length; break; }
    cursor = chunk.at(-1);
  }
  return {rows,total:Math.max(total ?? rows.length,rows.length),truncated:total === null ? rows.length === maximum : total > rows.length};
}

export async function streamSnapshot(db, cors, options = {}) {
  const pageSize = Math.min(500, Math.max(1, options.pageSize || 500));
  const tables = options.tables || SNAPSHOT_TABLES;
  const settingsResult = await db('wi_settings?select=settings&id=eq.true');
  const settings = Array.isArray(settingsResult.data) && settingsResult.data[0] ? settingsResult.data[0].settings : {};
  let cancelled = false;
  const counts = {}; let earliestEvent = null; let latestArrival = null;
  async function* generate() {
    yield encoder.encode('{');
    for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
      const [key, table, timeKey, idKey, maximum, reverse] = tables[tableIndex];
      const selected = await manifest(db, table, timeKey, idKey, maximum, () => cancelled);
      if (reverse) selected.rows.reverse();
      counts[key] = {returned:selected.rows.length,total:selected.total,truncated:selected.truncated};
      if (key === 'events') earliestEvent = selected.rows[0]?.[timeKey] ?? null;
      if (key === 'arrivals') latestArrival = selected.rows[0]?.[timeKey] ?? null;
      yield encoder.encode(`${tableIndex ? ',' : ''}${JSON.stringify(key)}:[`);
      // Fetch full rows only for a bounded batch of selected IDs. Restore the
      // manifest order explicitly so the legacy response ordering is identical.
      for (let offset = 0; offset < selected.rows.length;) {
        if (cancelled) return;
        // Only six bounded pages may be in flight. Do not accumulate the whole
        // report or prefetch another group until this one has been consumed.
        const batches = [];
        while (offset < selected.rows.length && batches.length < 6) {
          const ids = []; let encodedLength = 0;
          for (const row of selected.rows.slice(offset,offset + pageSize)) {
            const size = encodeURIComponent(quoted(row[idKey])).length + 3;
            if (ids.length && encodedLength + size > 6000) break;
            ids.push(row[idKey]); encodedLength += size;
          }
          batches.push({ids,prefix:offset > 0}); offset += ids.length;
        }
        const chunks = await Promise.all(batches.map(async ({ids,prefix}) => {
          const result = await db(`${table}?${q({select:'*',[idKey]:`in.(${ids.map(quoted).join(',')})`,limit:String(ids.length)})}`);
          if (!Array.isArray(result.data) || result.data.length !== ids.length) throw new Error(FAILURE);
          const byId = new Map(result.data.map(row => [row[idKey],row]));
          if (byId.size !== ids.length || ids.some(id => !byId.has(id))) throw new Error(FAILURE);
          return encoder.encode((prefix ? ',' : '') + ids.map(id => JSON.stringify(byId.get(id))).join(','));
        }));
        for (const bytes of chunks) { if (cancelled) return; yield bytes; }
      }
      yield encoder.encode(']');
    }
    const truncated = Object.values(counts).some(table => table.truncated);
    const meta = {generated_at:new Date().toISOString(),demo:false,source:'First-party Simworx events',timezone:'Europe/Madrid',tracking_active:(counts.events?.total || 0)>0,counts,
      diagnostics:{arrival_rows_returned:counts.arrivals?.returned || 0,arrival_rows_total:counts.arrivals?.total || 0,latest_arrival:latestArrival,snapshot_transport:'bounded-stream-v1',batch_rows:pageSize,batch_concurrency:6},
      truncated,earliest_event:earliestEvent,warning:truncated?'This snapshot is bounded. Some earlier records are outside the loaded data; totals and comparisons may be incomplete.':null};
    yield encoder.encode(`,"settings":${JSON.stringify(settings ?? {})},"meta":${JSON.stringify(meta)}}`);
  }
  const iterator = generate();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (cancelled) return;
        if (next.done) controller.close(); else controller.enqueue(next.value);
      } catch {
        if (!cancelled) {
          console.error('REPORT_SNAPSHOT_STREAM_FAILED');
          controller.error(new Error(FAILURE));
        }
      }
    },
    async cancel() { cancelled = true; await iterator.return(); },
  },{highWaterMark:1});
  return new Response(stream,{status:200,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Reports-Transport':'bounded-stream-v1'}});
}
