/**
 * Async Handler Utility
 * Wraps async route handlers to catch errors and pass them to Express error middleware
 */

/**
 * Wraps an async function to catch errors and pass them to Express error middleware
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Express middleware function
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        // If the function expects dependency injection (like { learningEngine }, req, res)
        if (fn.length === 3) {
            // Extract dependencies from req object (injected by middleware)
            const dependencies = req.dependencies || {};
            Promise.resolve(fn(dependencies, req, res)).catch(next);
        } else {
            // Standard Express middleware signature (req, res, next)
            Promise.resolve(fn(req, res, next)).catch(next);
        }
    };
}

module.exports = {
    asyncHandler
};
