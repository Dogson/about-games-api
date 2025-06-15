import { Column, DataType, Model } from 'sequelize-typescript';

export function JsonArrayField(field: string) {
  return function (target: object, propertyKey: string | symbol) {
    const options = {
      type: DataType.TEXT,
      field,
      get(this: Model): string[] {
        const raw = this.getDataValue(propertyKey as string) as unknown;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw) as string[];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      },
      set(this: Model, val: string[]) {
        if (!Array.isArray(val)) {
          throw new Error(
            `Invalid value assigned to ${String(propertyKey)}: expected string[]`,
          );
        }
        this.setDataValue(propertyKey as string, JSON.stringify(val));
      },
    };

    (Column(options) as (target: object, propertyKey: string | symbol) => void)(
      target,
      propertyKey,
    );
  };
}
