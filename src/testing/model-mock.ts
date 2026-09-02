export interface SequelizeModelMock {
  create: jest.Mock;
  bulkCreate: jest.Mock;
  findOne: jest.Mock;
  findByPk: jest.Mock;
  findAll: jest.Mock;
  findAndCountAll: jest.Mock;
  findOrCreate: jest.Mock;
  update: jest.Mock;
  destroy: jest.Mock;
  count: jest.Mock;
}

export function createModelMock(
  overrides: Partial<SequelizeModelMock> = {},
): SequelizeModelMock {
  return {
    create: jest.fn(),
    bulkCreate: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findOrCreate: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
    ...overrides,
  };
}

/**
 * Bridges a plain-object mock to the compiled Sequelize model class type the
 * services expect at runtime. The cast is only used in tests; no `any`.
 */
export function asModelType<T>(mock: unknown): T {
  return mock as T;
}
