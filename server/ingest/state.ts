import { db } from "../db";
import { CollectionOperations } from "./operations";
export const operations = new CollectionOperations({
  get: async (key) =>
    (await db.setting.findUnique({ where: { key } }))?.value || null,
  list: (prefix) =>
    db.setting.findMany({
      where: { key: { startsWith: prefix } },
      select: { key: true, value: true },
    }),
  cas: async (key, previous, value) => {
    if (previous === null) {
      try {
        await db.setting.create({ data: { key, value } });
        return true;
      } catch (error) {
        if (
          typeof error === "object" &&
          error &&
          "code" in error &&
          error.code === "P2002"
        )
          return false;
        throw error;
      }
    }
    return (
      (
        await db.setting.updateMany({
          where: { key, value: previous },
          data: { value },
        })
      ).count === 1
    );
  },
});
