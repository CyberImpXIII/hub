'use strict';
// A small JSON Schema validator (the draft-07 subset hub.schema.json uses), so the
// registry's shape is one declarative file that setup's idempotent check and this
// program read alike, with no package (CLAUDE.md: Node, no packages). Keywords:
// type (a string or a list), properties, required, additionalProperties (a boolean
// or a schema), propertyNames (with enum), enum, const, items, minItems,
// minimum, maximum, minLength, pattern, oneOf, anyOf. An unknown keyword is an
// error, never ignored: a schema that said more than this validator reads would
// be a guard that looks installed and is not.
//
// validate(schema, data) -> [] when it holds, else one `<path>: <message>` line per
// finding, paths dotted from the root (`roles.operator.mode`).

const KNOWN = new Set(['$schema', '$id', 'title', 'description', 'type', 'properties', 'required', 'additionalProperties',
  'propertyNames', 'enum', 'const', 'items', 'minItems', 'minimum', 'maximum', 'minLength', 'pattern', 'oneOf', 'anyOf', 'default', 'examples']);

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(want, v) {
  const t = typeOf(v);
  return want === t || (want === 'number' && t === 'integer');
}

function show(v) { return JSON.stringify(v); }

function check(schema, data, at, out) {
  if (schema === true) return;
  if (schema === false) { out.push(`${at}: not allowed`); return; }
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k)) throw new Error(`hub.schema.json: unknown keyword "${k}" at ${at || '(root)'}: this validator does not read it`);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, data))) {
      out.push(`${at}: must be ${types.join(' or ')}, not ${typeOf(data)}`);
      return;
    }
  }
  if (schema.enum !== undefined && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) {
    out.push(`${at}: ${show(data)} is not one of ${schema.enum.map((e) => (typeof e === 'string' ? e : show(e))).join(', ')}`);
    return;
  }
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(data)) {
    out.push(`${at}: must be ${show(schema.const)}`);
    return;
  }
  if (schema.oneOf) {
    const hits = schema.oneOf.filter((s) => check(s, data, at, []) === undefined && validate(s, data, at).length === 0);
    if (hits.length !== 1) out.push(`${at}: matches ${hits.length} of the ${schema.oneOf.length} allowed shapes, not exactly one`);
  }
  if (schema.anyOf && !schema.anyOf.some((s) => validate(s, data, at).length === 0)) {
    // name the findings of the one alternative whose type the data has, else the count
    const same = schema.anyOf.filter((s) => s.type !== undefined && (Array.isArray(s.type) ? s.type : [s.type]).some((x) => typeMatches(x, data)));
    if (same.length === 1) out.push(...validate(same[0], data, at));
    else out.push(`${at}: matches none of the ${schema.anyOf.length} allowed shapes`);
  }
  const t = typeOf(data);
  if (t === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) out.push(`${at}: must be at least ${schema.minLength} character(s)`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) out.push(`${at}: must match ${schema.pattern}`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) out.push(`${at}: must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) out.push(`${at}: must be at most ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems !== undefined && data.length < schema.minItems) out.push(`${at}: must hold at least ${schema.minItems} item(s)`);
    if (schema.items !== undefined) data.forEach((v, i) => check(schema.items, v, `${at}[${i}]`, out));
  }
  if (t === 'object') {
    const props = schema.properties || {};
    for (const r of schema.required || []) if (!Object.prototype.hasOwnProperty.call(data, r)) out.push(`${at || 'hub.json'}: missing "${r}"`);
    for (const [k, v] of Object.entries(data)) {
      const sub = at ? `${at}.${k}` : k;
      if (schema.propertyNames && schema.propertyNames.enum && !schema.propertyNames.enum.includes(k)) {
        out.push(`${sub}: "${k}" is not one of the allowed keys (${schema.propertyNames.enum.join(', ')})`);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(props, k)) check(props[k], v, sub, out);
      else if (schema.additionalProperties === false) out.push(`${sub}: unknown key "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') check(schema.additionalProperties, v, sub, out);
    }
  }
}

function validate(schema, data, at = '') {
  const out = [];
  check(schema, data, at, out);
  return out;
}

module.exports = { validate, typeOf };
