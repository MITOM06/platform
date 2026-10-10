import { applyExporterDefaults } from "./tracing-defaults";

describe("applyExporterDefaults", () => {
  it("turns metrics and logs export off unless configured (Jaeger takes traces only)", () => {
    const env: NodeJS.ProcessEnv = {};
    applyExporterDefaults(env);
    expect(env.OTEL_METRICS_EXPORTER).toBe("none");
    expect(env.OTEL_LOGS_EXPORTER).toBe("none");
  });

  it("keeps an explicit choice", () => {
    const env: NodeJS.ProcessEnv = {
      OTEL_METRICS_EXPORTER: "prometheus",
      OTEL_LOGS_EXPORTER: "otlp",
    };
    applyExporterDefaults(env);
    expect(env.OTEL_METRICS_EXPORTER).toBe("prometheus");
    expect(env.OTEL_LOGS_EXPORTER).toBe("otlp");
  });
});
