import { db, schema } from "../../db/client";
// import { ENV_CONFIG } from "../../env.config";
import { sql } from "drizzle-orm";
import bcryptjs from "bcryptjs";

export default async () => {
  // if (!["development"].includes(ENV_CONFIG.NODE_ENV)) {
  //   console.log("🚫 Aborting for for non-development environment!");
  //   return;
  // }

  const tablesFromKeys = Object.keys(schema)
    .reverse()
    .filter((x) => x.includes("Relations") === false);

  const queries = tablesFromKeys.map((table) => {
    return sql.raw(`DELETE FROM "${table}";`);
  });

  await db.transaction(async (trx) => {
    await Promise.all(
      queries.map(async (query) => {
        if (query) await trx.run(query);
      })
    );
  });

  // add admin & user accounts for testing
  const hashedPassword = await bcryptjs.hash("123123", 10);
  await db.insert(schema.users).values({
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "admin",
    email: "admin@mail.com",
    hashedPassword,
    locale: "en",
    timezone: "Asia/Riyadh",
    isAdmin: true,
    emailVerified: true,
  });
  await db.insert(schema.users).values({
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "user",
    email: "user@mail.com",
    hashedPassword,
    locale: "en",
    timezone: "Asia/Riyadh",
    emailVerified: true,
  });

  // add team
  await db.insert(schema.teams).values({
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: 2,
    name: "Software Development Team",
    isPersonal: false,
  });

  console.log("✅ Database has been reset");
};
