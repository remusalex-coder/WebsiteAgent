/**
 * HTML construction primitives.
 *
 * Every string that reaches the page passes through here, and the `Html` type
 * is what makes that checkable rather than a convention: a plain `string` is
 * never accepted as markup. To put content on the page you either escape it
 * with `text()` or opt out explicitly with `raw()`, and `raw()` is greppable.
 *
 * Serialisation is deterministic — attributes keep the order they were
 * declared in, and indentation is a pure function of nesting depth. The same
 * input produces the same bytes, which is what makes the snapshot tests
 * meaningful.
 */

declare const HTML_BRAND: unique symbol;

/** Markup that is known to be escaped. The only thing the builders accept. */
export type Html = string & { readonly [HTML_BRAND]: true };

/** Attribute values. `null`, `undefined` and `false` omit the attribute. */
export type AttributeValue = string | number | boolean | null | undefined;

export type Attributes = Readonly<Record<string, AttributeValue>>;

/** Children accept `null` so a caller can inline a conditional. */
export type Children = Html | readonly (Html | null)[] | null;

/**
 * Elements whose content model is empty. Serialised without a closing tag —
 * HTML5 needs no self-closing slash, and omitting it keeps the output canonical.
 */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

const EMPTY = '' as Html;

function brand(value: string): Html {
  return value as Html;
}

/**
 * Escapes text for a text node.
 *
 * `<` and `&` are what actually change parsing; `>` is escaped too because a
 * stray `-->` inside a comment-adjacent context is cheaper to prevent than to
 * reason about.
 */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes a value for a double-quoted attribute.
 *
 * Single quotes are escaped as well as double: attributes here are always
 * double-quoted, but an escaper that is only correct for one quoting style is
 * a trap for whoever changes the quoting style.
 */
export function escapeAttribute(value: string): string {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped text content. This is how user copy gets onto the page. */
export function text(value: string): Html {
  return brand(escapeText(value));
}

/**
 * Marks a string as markup without escaping it.
 *
 * Only for strings this module built itself — a doctype, a serialised JSON-LD
 * payload that was escaped by its own rules. Never for content from an agent.
 */
export function raw(trusted: string): Html {
  return brand(trusted);
}

/**
 * Concatenates markup, dropping absent pieces.
 *
 * Empty strings are dropped as well as nulls: a section renderer returns
 * `empty` for a part it had nothing to render, and joining that with a newline
 * would leave a blank line in the output for every optional field the spec
 * omitted.
 */
export function join(parts: readonly (Html | null)[], separator = ''): Html {
  return brand(
    parts.filter((part): part is Html => part !== null && part !== '').join(separator),
  );
}

export function isEmpty(value: Html): boolean {
  return value === '';
}

export const empty: Html = EMPTY;

/** Serialises attributes in declaration order, dropping absent ones. */
export function attributes(record: Attributes): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === false) continue;
    // A boolean attribute is present or absent; it carries no value.
    if (value === true) {
      parts.push(` ${name}`);
      continue;
    }
    parts.push(` ${name}="${escapeAttribute(String(value))}"`);
  }
  return parts.join('');
}

/** Indents every non-blank line by one level, so nesting reads in the output. */
function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');
}

/**
 * Width an element may reach before it is broken across lines.
 *
 * The same idea as a code formatter's print width, and here for the same
 * reason: generated markup is read in diffs, and a page that is three enormous
 * lines makes a one-attribute change look like a rewrite.
 */
const PRINT_WIDTH = 100;

/**
 * Builds an element.
 *
 * A single child stays on one line while the whole element fits inside
 * `PRINT_WIDTH`; anything longer, and anything with more than one child, is
 * broken and indented. Layout depends on the tree and the widths in it, never
 * on anything outside — so it is stable across runs and machines.
 */
export function element(name: string, attrs: Attributes = {}, children: Children = null): Html {
  const open = `<${name}${attributes(attrs)}>`;

  if (VOID_ELEMENTS.has(name)) return brand(open);

  const list = children === null ? [] : Array.isArray(children) ? children : [children as Html];
  const present = list.filter((child): child is Html => child !== null && child !== '');

  if (present.length === 0) return brand(`${open}</${name}>`);

  const single = present.length === 1 ? present[0] : undefined;
  if (
    single !== undefined &&
    !single.includes('\n') &&
    open.length + single.length + name.length + 3 <= PRINT_WIDTH
  ) {
    return brand(`${open}${single}</${name}>`);
  }

  return brand(`${open}\n${indent(present.join('\n'))}\n</${name}>`);
}

/**
 * Splits prose into paragraphs on blank lines.
 *
 * Single newlines are soft wraps in the source and become spaces, the same way
 * a browser would treat them. Copy that is one block stays one `<p>`.
 */
export function paragraphs(body: string, attrs: Attributes = {}): Html {
  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block !== '');

  return join(blocks.map((block) => element('p', attrs, text(block))), '\n');
}

/**
 * A URL-safe slug for an anchor.
 *
 * Returns `''` for input with no ASCII alphanumerics — a Chinese or Arabic
 * heading yields nothing usable here, and the caller falls back to a positional
 * id rather than emitting a broken fragment.
 */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Serialises a value as JSON-LD safe to sit inside a `<script>` element.
 *
 * Object keys are sorted, so two semantically identical payloads serialise
 * identically no matter what order the writer emitted them in. `<` is escaped
 * because `</script>` inside the payload would otherwise close the element and
 * turn data into markup — the one injection this element is vulnerable to.
 */
export function jsonLd(value: unknown): Html {
  const serialised = JSON.stringify(sortKeys(value), null, 2) ?? 'null';
  return brand(
    serialised
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
  );
}

/** Recursively orders object keys. Arrays keep their order — it is meaningful. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== 'object' || value === null) return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return out;
}
