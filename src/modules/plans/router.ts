import {
  router,
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  trpcError,
} from "../../trpc/core";
import { z } from "zod";
import { db, schema } from "../../db/client";
import { eq, ne, and, asc } from "drizzle-orm";

export const plans = router({
  create: adminProcedure
    .input(z.object({ name: z.string(), price: z.number() }))
    .mutation(async ({ input }) => {
      const { name, price } = input;
      if (price < 0) {
        throw new trpcError({ code: "BAD_REQUEST" });
      }
      // check if plan name is taken
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.name, name),
      });
      if (plan) {
        throw new trpcError({ code: "BAD_REQUEST" });
      }
      await db.insert(schema.plans).values({
        name,
        price,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { success: true };
    }),
  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string(), price: z.number() }))
    .mutation(async ({ input }) => {
      const { id, name, price } = input;
      if (price < 0) {
        throw new trpcError({ code: "BAD_REQUEST" });
      }
      // check if name is taken by another plan
      const plan = await db.query.plans.findFirst({
        where: and(eq(schema.plans.name, name), ne(schema.plans.id, id)),
      });
      if (plan !== undefined) {
        throw new trpcError({ code: "BAD_REQUEST" });
      }
      await db
        .update(schema.plans)
        .set({ name: name, price: price })
        .where(eq(schema.plans.id, id));

      return { success: true };
    }),
  get: publicProcedure.query(async () => {
    const plans = await db.query.plans.findMany({
      orderBy: [asc(schema.plans.price)],
    });
    return { plans };
  }),
  upgrade: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx: user, input }) => {
      const { id } = input; // new plan id
      const userId = user.user.userId;
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, id),
      });
      // non existing plan
      if (plan === undefined) {
        throw new trpcError({ code: "NOT_FOUND" });
      }
      const currentSubscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.userId, userId),
          eq(schema.subscriptions.isCancelled, false)
        ),
      });
      if (currentSubscription === undefined) return { price: plan.price };
      const currentPlan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, currentSubscription.planId),
      });
      if (currentPlan === undefined) return { price: plan.price };

      const remainingDays = Math.floor(
        Date.parse(currentSubscription.validTo.toString()) -
          Date.parse(new Date().toString()) / 86400000
      );
      const price =
        plan.price - Math.floor((remainingDays * currentPlan?.price) / 30);

      return { price };
    }),
  subscribe: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx: user, input }) => {
      const { id } = input;
      const userId = user.user.userId;
      // cancel prev subscriptions
      await db
        .update(schema.subscriptions)
        .set({ isCancelled: true, updatedAt: new Date() })
        .where(
          and(
            eq(schema.subscriptions.userId, userId),
            eq(schema.subscriptions.isCancelled, false)
          )
        );
      // add new subscription
      const date = new Date();
      date.setDate(date.getDate() + 30);
      await db.insert(schema.subscriptions).values({
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: userId,
        planId: id,
        validTo: date,
      });

      return { success: true };
    }),
});
