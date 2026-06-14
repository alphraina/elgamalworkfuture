/**
 * Minimal stub for shell-quote (blocked by Replit package firewall).
 * Implements the core API used by react-devtools-core.
 */

function parse(s, env) {
  var words = [];
  var current = '';
  var inSingle = false;
  var inDouble = false;

  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      else current += c;
    } else if (inDouble) {
      if (c === '"') inDouble = false;
      else if (c === '\\' && i + 1 < s.length) { i++; current += s[i]; }
      else current += c;
    } else if (c === "'") {
      inSingle = true;
    } else if (c === '"') {
      inDouble = true;
    } else if (c === ' ' || c === '\t' || c === '\n') {
      if (current) { words.push(current); current = ''; }
    } else {
      current += c;
    }
  }
  if (current) words.push(current);
  return words;
}

function quote(args) {
  return args.map(function(a) {
    if (/[^A-Za-z0-9_\-.,:/]/.test(a)) {
      return "'" + a.replace(/'/g, "'\"'\"'") + "'";
    }
    return a || "''";
  }).join(' ');
}

module.exports = { parse: parse, quote: quote };
