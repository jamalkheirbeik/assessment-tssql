import {
  router,
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  trpcError,
} from "../../trpc/core";
import { z } from "zod";
import { db, schema } from "../../db/client";
import { eq, ne, and, asc, desc } from "drizzle-orm";

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
    .input(z.object({ planId: z.number(), teamId: z.number() }))
    .mutation(async ({ ctx: user, input }) => {
      const { planId, teamId } = input;
      const userId = user.user.userId;
      console.log(userId);
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, planId),
      });
      // non existing plan
      if (plan === undefined) {
        throw new trpcError({ code: "NOT_FOUND" });
      }

      const lastActivation = await db
        .select({
          planPrice: schema.plans.price,
          createdAt: schema.subscriptionActivations.createdAt,
        })
        .from(schema.subscriptions)
        .innerJoin(
          schema.plans,
          eq(schema.subscriptions.planId, schema.plans.id)
        )
        .innerJoin(
          schema.orders,
          eq(schema.subscriptions.id, schema.orders.subscriptionId)
        )
        .innerJoin(
          schema.subscriptionActivations,
          eq(schema.subscriptionActivations.orderId, schema.orders.id)
        )
        .where(eq(schema.subscriptions.teamId, teamId))
        .orderBy(desc(schema.subscriptionActivations.createdAt))
        .limit(1);

      // order payment not found
      if (lastActivation.length === 0 || lastActivation[0] === undefined) {
        return { price: plan.price };
      }

      const validTo = new Date(lastActivation[0].createdAt);
      validTo.setDate(validTo.getDate() + 30);
      const currentDate = new Date();
      // outdated payment
      if (validTo.getDate() - currentDate.getDate() <= 0) {
        return { price: plan.price };
      }

      const remainingDays = Math.floor(
        Date.parse(validTo.toString()) -
          Date.parse(currentDate.toString()) / 86400000
      );
      const price =
        plan.price -
        Math.floor((remainingDays * lastActivation[0].planPrice) / 30);
      return { price };
    }),
  subscribe: protectedProcedure
    .input(z.object({ planId: z.number(), teamId: z.number() }))
    .mutation(async ({ ctx: user, input }) => {
      const { planId, teamId } = input;
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
      await db.insert(schema.subscriptions).values({
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: userId,
        planId: planId,
        teamId: teamId,
      });

      return { success: true };
    }),
});
