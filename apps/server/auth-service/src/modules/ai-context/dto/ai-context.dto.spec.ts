import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateHardContextDto } from './ai-context.dto';

const errorsOf = (body: unknown) =>
  validate(plainToInstance(UpdateHardContextDto, body as object));

describe('UpdateHardContextDto — projects', () => {
  it('accepts up to 20 projects of up to 200 characters', async () => {
    const projects = Array.from({ length: 20 }, () => 'p'.repeat(200));
    await expect(errorsOf({ projects })).resolves.toHaveLength(0);
  });

  it('rejects more than 20 projects', async () => {
    const projects = Array.from({ length: 21 }, (_, i) => `p${i}`);
    const [error] = await errorsOf({ projects });
    expect(error.constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects a project longer than 200 characters', async () => {
    const [error] = await errorsOf({ projects: ['ok', 'p'.repeat(201)] });
    expect(error.constraints).toHaveProperty('maxLength');
  });

  it('rejects a non-string project', async () => {
    const [error] = await errorsOf({ projects: [42] });
    expect(error.constraints).toHaveProperty('isString');
  });
});
