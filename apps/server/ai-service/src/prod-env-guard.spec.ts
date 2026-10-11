import { findFatalInfraProblems } from './prod-env-guard';

const OK = {
  MONGODB_URI: 'mongodb://mongo:27017/platform',
  REDIS_HOST: 'redis',
  RABBITMQ_URL: 'amqp://u:p@rabbitmq:5672',
};

describe('findFatalInfraProblems', () => {
  it('accepts container addresses', () => {
    expect(findFatalInfraProblems(OK)).toEqual([]);
  });

  // compose.prod.yml passes `REDIS_URL: ${REDIS_URL:-}`, i.e. an EMPTY string when
  // the operator did not set one. Empty must mean "not set" so REDIS_HOST counts.
  it('treats an empty REDIS_URL as unset and falls back to REDIS_HOST', () => {
    expect(findFatalInfraProblems({ ...OK, REDIS_URL: '' })).toEqual([]);
  });

  it('prefers a set REDIS_URL over REDIS_HOST', () => {
    expect(
      findFatalInfraProblems({ ...OK, REDIS_URL: 'redis://localhost:6379', REDIS_HOST: 'redis' }),
    ).toEqual(['REDIS_URL / REDIS_HOST']);
  });

  it('rejects missing and loopback addresses', () => {
    expect(
      findFatalInfraProblems({ MONGODB_URI: '', REDIS_HOST: '', RABBITMQ_URL: 'amqp://127.0.0.1' }),
    ).toEqual(['MONGODB_URI', 'REDIS_URL / REDIS_HOST', 'RABBITMQ_URL']);
  });
});
