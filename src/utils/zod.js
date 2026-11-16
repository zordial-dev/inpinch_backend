/**
 * Lightweight Zero-Dependency Schema Validation Engine with Zod-compatible API.
 * Provides string trimming, input sanitization, type coercion, regex validation,
 * financial bounds checking, and standardized error formatting.
 */

class ValidationError extends Error {
  constructor(issues) {
    super('Validation Error');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 * XSS-safe input sanitization preserving Hindi/Devanagari, Unicode, standard punctuation,
 * and multiline content.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\s*on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:\s*/gi, '');
}

class StringSchema {
  constructor() {
    this._email = false;
    this._min = null;
    this._max = null;
    this._optional = false;
    this._nullable = false;
    this._trim = true;
    this._enum = null;
    this._regex = null;
    this._defaultValue = undefined;
    this._refines = [];
    this._transforms = [];
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  trim(enable = true) {
    this._trim = enable;
    return this;
  }

  email(msg = 'Invalid email address format') {
    this._email = true;
    this._emailMsg = msg;
    return this;
  }

  min(length, msg) {
    this._min = { length, msg: msg || `Must be at least ${length} characters` };
    return this;
  }

  max(length, msg) {
    this._max = { length, msg: msg || `Must not exceed ${length} characters` };
    return this;
  }

  regex(pattern, msg = 'Invalid format') {
    this._regex = { pattern, msg };
    return this;
  }

  enum(values, msg) {
    this._enum = { values, msg: msg || `Must be one of: ${values.join(', ')}` };
    return this;
  }

  refine(fn, msg = 'Validation failed') {
    this._refines.push({ fn, msg });
    return this;
  }

  transform(fn) {
    this._transforms.push(fn);
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }

    if (val === undefined || val === null || val === '') {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
      throw [{ field: path, message: 'Field is required' }];
    }

    if (typeof val !== 'string') {
      throw [{ field: path, message: 'Expected string type' }];
    }

    let clean = this._trim ? sanitizeString(val) : val;

    if (this._enum && !this._enum.values.includes(clean)) {
      throw [{ field: path, message: this._enum.msg }];
    }

    if (this._email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clean)) {
        throw [{ field: path, message: this._emailMsg }];
      }
    }

    if (this._min && clean.length < this._min.length) {
      throw [{ field: path, message: this._min.msg }];
    }

    if (this._max && clean.length > this._max.length) {
      throw [{ field: path, message: this._max.msg }];
    }

    if (this._regex && !this._regex.pattern.test(clean)) {
      throw [{ field: path, message: this._regex.msg }];
    }

    for (const r of this._refines) {
      if (!r.fn(clean)) {
        throw [{ field: path, message: r.msg }];
      }
    }

    for (const t of this._transforms) {
      clean = t(clean);
    }

    return clean;
  }
}

class NumberSchema {
  constructor(coerce = false) {
    this._coerce = coerce;
    this._min = null;
    this._max = null;
    this._positive = false;
    this._optional = false;
    this._nullable = false;
    this._int = false;
    this._maxDigitsBeforeDecimal = null;
    this._maxDecimals = null;
    this._defaultValue = undefined;
    this._refines = [];
    this._transforms = [];
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  positive(msg = 'Must be a positive number') {
    this._positive = true;
    this._positiveMsg = msg;
    return this;
  }

  min(val, msg) {
    this._min = { val, msg: msg || `Must be at least ${val}` };
    return this;
  }

  max(val, msg) {
    this._max = { val, msg: msg || `Must not exceed ${val}` };
    return this;
  }

  int(msg = 'Must be an integer') {
    this._int = true;
    this._intMsg = msg;
    return this;
  }

  maxDigitsBeforeDecimal(digits = 6, msg) {
    this._maxDigitsBeforeDecimal = {
      digits,
      msg: msg || `Must have at most ${digits} digits before the decimal point`
    };
    return this;
  }

  maxDecimals(decimals = 2, msg) {
    this._maxDecimals = {
      decimals,
      msg: msg || `Must have at most ${decimals} decimal places`
    };
    return this;
  }

  refine(fn, msg = 'Validation failed') {
    this._refines.push({ fn, msg });
    return this;
  }

  transform(fn) {
    this._transforms.push(fn);
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }

    if (val === undefined || val === null || val === '') {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
      throw [{ field: path, message: 'Field is required' }];
    }

    let num = val;
    if (this._coerce && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') {
        if (this._defaultValue !== undefined) return this._defaultValue;
        if (this._optional) return undefined;
        throw [{ field: path, message: 'Field is required' }];
      }
      num = Number(trimmed);
    }

    if (typeof num !== 'number' || Number.isNaN(num) || !Number.isFinite(num)) {
      throw [{ field: path, message: 'Expected numeric type' }];
    }

    if (this._positive && num <= 0) {
      throw [{ field: path, message: this._positiveMsg }];
    }

    if (this._min && num < this._min.val) {
      throw [{ field: path, message: this._min.msg }];
    }

    if (this._max && num > this._max.val) {
      throw [{ field: path, message: this._max.msg }];
    }

    if (this._int && !Number.isInteger(num)) {
      throw [{ field: path, message: this._intMsg }];
    }

    if (this._maxDigitsBeforeDecimal) {
      const absStr = Math.abs(num).toString();
      const intPart = absStr.split('.')[0];
      if (intPart.length > this._maxDigitsBeforeDecimal.digits) {
        throw [{ field: path, message: this._maxDigitsBeforeDecimal.msg }];
      }
    }

    if (this._maxDecimals) {
      const strVal = typeof val === 'string' ? val.trim() : num.toString();
      const parts = strVal.split('.');
      if (parts[1] && parts[1].length > this._maxDecimals.decimals) {
        throw [{ field: path, message: this._maxDecimals.msg }];
      }
    }

    for (const r of this._refines) {
      if (!r.fn(num)) {
        throw [{ field: path, message: r.msg }];
      }
    }

    for (const t of this._transforms) {
      num = t(num);
    }

    return num;
  }
}

class BooleanSchema {
  constructor(coerce = false) {
    this._coerce = coerce;
    this._optional = false;
    this._nullable = false;
    this._defaultValue = undefined;
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }

    if (val === undefined || val === null || val === '') {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
      throw [{ field: path, message: 'Field is required' }];
    }

    if (this._coerce) {
      if (val === 'true' || val === '1' || val === 1 || val === true) return true;
      if (val === 'false' || val === '0' || val === 0 || val === false) return false;
    }

    if (typeof val !== 'boolean') {
      throw [{ field: path, message: 'Expected boolean type' }];
    }

    return val;
  }
}

class ArraySchema {
  constructor(elementSchema) {
    this._elementSchema = elementSchema;
    this._min = null;
    this._max = null;
    this._optional = false;
    this._nullable = false;
    this._defaultValue = undefined;
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  min(length, msg) {
    this._min = { length, msg: msg || `Array must contain at least ${length} item(s)` };
    return this;
  }

  max(length, msg) {
    this._max = { length, msg: msg || `Array must contain at most ${length} item(s)` };
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }

    if (val === undefined || val === null) {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
      throw [{ field: path, message: 'Field is required' }];
    }

    if (!Array.isArray(val)) {
      throw [{ field: path, message: 'Expected array type' }];
    }

    if (this._min && val.length < this._min.length) {
      throw [{ field: path, message: this._min.msg }];
    }

    if (this._max && val.length > this._max.length) {
      throw [{ field: path, message: this._max.msg }];
    }

    const issues = [];
    const parsedArray = val.map((item, idx) => {
      try {
        return this._elementSchema.parse(item, `${path}[${idx}]`);
      } catch (errs) {
        if (Array.isArray(errs)) issues.push(...errs);
        else issues.push({ field: `${path}[${idx}]`, message: errs.message || 'Invalid item' });
      }
    });

    if (issues.length > 0) throw issues;
    return parsedArray;
  }
}

class ObjectSchema {
  constructor(shape) {
    this._shape = shape;
    this._optional = false;
    this._nullable = false;
    this._passthrough = false;
    this._strict = false;
    this._strictMsg = 'Unrecognized field in payload';
    this._defaultValue = undefined;
    this._preprocessors = [];
    this._refines = [];
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  passthrough() {
    this._passthrough = true;
    this._strict = false;
    return this;
  }

  strip() {
    this._passthrough = false;
    this._strict = false;
    return this;
  }

  strict(msg) {
    this._strict = true;
    this._passthrough = false;
    if (msg) this._strictMsg = msg;
    return this;
  }

  preprocess(fn) {
    this._preprocessors.push(fn);
    return this;
  }

  refine(fn, msg = 'Validation failed') {
    this._refines.push({ fn, msg });
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }

    if (val === undefined || val === null) {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
      throw [{ field: path || 'root', message: 'Expected object payload' }];
    }

    if (typeof val !== 'object' || Array.isArray(val)) {
      throw [{ field: path || 'root', message: 'Expected object type' }];
    }

    let inputObj = { ...val };
    for (const pre of this._preprocessors) {
      inputObj = pre(inputObj);
    }

    const issues = [];

    if (this._strict) {
      const allowedKeys = new Set(Object.keys(this._shape));
      for (const key of Object.keys(inputObj)) {
        if (!allowedKeys.has(key)) {
          issues.push({ field: path ? `${path}.${key}` : key, message: `${this._strictMsg}: '${key}'` });
        }
      }
    }

    const result = this._passthrough ? { ...inputObj } : {};

    for (const [key, schema] of Object.entries(this._shape)) {
      const fieldPath = path ? `${path}.${key}` : key;
      try {
        const parsedVal = schema.parse(inputObj[key], fieldPath);
        if (parsedVal !== undefined) {
          result[key] = parsedVal;
        }
      } catch (errs) {
        if (Array.isArray(errs)) issues.push(...errs);
        else issues.push({ field: fieldPath, message: errs.message || 'Invalid field' });
      }
    }

    for (const r of this._refines) {
      try {
        if (!r.fn(result)) {
          issues.push({ field: path || 'root', message: r.msg });
        }
      } catch (err) {
        issues.push({ field: path || 'root', message: err.message || r.msg });
      }
    }

    if (issues.length > 0) throw issues;
    return result;
  }
}

class UnionSchema {
  constructor(schemas) {
    this._schemas = schemas;
    this._optional = false;
    this._nullable = false;
    this._defaultValue = undefined;
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }

    if (val === undefined || val === null || val === '') {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
      throw [{ field: path, message: 'Field is required' }];
    }

    for (const schema of this._schemas) {
      try {
        return schema.parse(val, path);
      } catch (_) {}
    }

    throw [{ field: path, message: 'Value did not match any allowed type in union' }];
  }
}

class AnySchema {
  constructor() {
    this._optional = false;
    this._nullable = false;
    this._defaultValue = undefined;
  }

  optional() {
    this._optional = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  default(val) {
    this._defaultValue = val;
    return this;
  }

  parse(val, path = '') {
    if (val === null && this._nullable) {
      return null;
    }
    if (val === undefined || val === null) {
      if (this._defaultValue !== undefined) return this._defaultValue;
      if (this._optional) return undefined;
    }
    return val;
  }
}

class PreprocessedSchema {
  constructor(preprocessor, schema) {
    this._preprocessor = preprocessor;
    this._schema = schema;
  }

  parse(val, path = '') {
    const transformed = this._preprocessor(val);
    return this._schema.parse(transformed, path);
  }
}

const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(false),
  boolean: () => new BooleanSchema(false),
  array: (schema) => new ArraySchema(schema),
  object: (shape) => new ObjectSchema(shape),
  union: (schemas) => new UnionSchema(schemas),
  enum: (values, msg) => new StringSchema().enum(values, msg),
  any: () => new AnySchema(),
  preprocess: (fn, schema) => new PreprocessedSchema(fn, schema),
  coerce: {
    string: () => new StringSchema().transform(v => String(v)),
    number: () => new NumberSchema(true),
    boolean: () => new BooleanSchema(true)
  },
  ValidationError
};

module.exports = z;
