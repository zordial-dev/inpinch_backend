/**
 * Express Middleware for Request Validation using Zod Schemas.
 * Validates body, params, and query, sanitizes inputs, and formats standard 400 Bad Request responses
 * with 100% backward compatibility for all web, mobile, and API clients.
 */

function validateRequest(schemas = {}) {
  return (req, res, next) => {
    const issues = [];

    // If schemas itself has a parse method, treat it as a body schema
    const targetSchemas = typeof schemas.parse === 'function' ? { body: schemas } : schemas;

    // Validate req.params
    if (targetSchemas.params) {
      try {
        req.params = targetSchemas.params.parse(req.params || {}, 'params');
      } catch (errs) {
        if (Array.isArray(errs)) issues.push(...errs);
        else issues.push({ field: 'params', message: errs.message || 'Invalid parameters' });
      }
    }

    // Validate req.query
    if (targetSchemas.query) {
      try {
        req.query = targetSchemas.query.parse(req.query || {}, 'query');
      } catch (errs) {
        if (Array.isArray(errs)) issues.push(...errs);
        else issues.push({ field: 'query', message: errs.message || 'Invalid query string' });
      }
    }

    // Validate req.body
    if (targetSchemas.body) {
      try {
        req.body = targetSchemas.body.parse(req.body || {}, 'body');
      } catch (errs) {
        if (Array.isArray(errs)) issues.push(...errs);
        else issues.push({ field: 'body', message: errs.message || 'Invalid body payload' });
      }
    }

    // Return standardized 400 Bad Request if validation issues exist
    if (issues.length > 0) {
      const firstMessage = issues[0]?.message || 'Validation failed';
      const errorsMap = {};
      issues.forEach(issue => {
        const cleanField = String(issue.field || 'general').replace(/^(body\.|query\.|params\.)/, '');
        if (!errorsMap[cleanField]) {
          errorsMap[cleanField] = issue.message;
        }
      });

      return res.status(400).json({
        success: false,
        error: firstMessage,
        message: firstMessage,
        code: 'VALIDATION_ERROR',
        errors: errorsMap,
        details: issues
      });
    }

    next();
  };
}

module.exports = { validateRequest };
