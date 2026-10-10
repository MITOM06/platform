// Nest's default webpack build bundles every dependency into dist/main.js here
// (node-linker=hoisted leaves no local node_modules for nodeExternals to read).
// OpenTelemetry, as imported by src/tracing.ts, must stay a real runtime module:
// its auto-instrumentation loads instrumentations dynamically and patches modules
// through require(). The image ships the production node_modules (Dockerfile
// `proddeps`), so it resolves there. Only our own imports are external: the
// OpenTelemetry copies @sentry/node pins stay bundled at the versions it wants.
module.exports = function (options) {
  return {
    ...options,
    externals: [
      ...(options.externals ?? []),
      // `commonjs` = a runtime require(), not a global variable.
      ({ request, context }, callback) =>
        /^@opentelemetry\//.test(request ?? '') && !(context ?? '').includes('node_modules')
          ? callback(null, `commonjs ${request}`)
          : callback(),
    ],
  };
};
