import { beforeAll, describe, expect, it } from "vitest";
import { createAuthenticatedCaller, createCaller } from "../helpers/utils";
import { trpcError } from "../../trpc/core";
import resetDb from "../helpers/resetDb";

describe("plans routes", async () => {
  beforeAll(async () => {
    await resetDb();
  });

  describe("create", async () => {
    it("should throw an error if the user is not an admin", async () => {
      const plan = { name: "Tier 1", price: 10 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 2 });
      expect(authenticatedUser.plans.create(plan)).rejects.toThrowError(
        new trpcError({ code: "UNAUTHORIZED" })
      );
    });

    it("should throw an error if price value is negative", async () => {
      const plan = { name: "Tier 1", price: -10 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 1 });
      expect(authenticatedUser.plans.create(plan)).rejects.toThrowError(
        new trpcError({ code: "BAD_REQUEST" })
      );
    });

    it("should create the plan successfully", async () => {
      const plan = { name: "Tier 1", price: 10 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 1 });
      const response = await authenticatedUser.plans.create(plan);
      expect(response.success).toBe(true);
    });

    it("should throw an error if name is taken", async () => {
      const plan = { name: "Tier 1", price: 10 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 1 });
      expect(authenticatedUser.plans.create(plan)).rejects.toThrowError(
        new trpcError({ code: "BAD_REQUEST" })
      );
    });
  });

  describe("update", async () => {
    it("should throw an error if the user is not an admin", async () => {
      const data = { id: 1, name: "Free Tier", price: 0 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 2 });
      expect(authenticatedUser.plans.update(data)).rejects.toThrowError(
        new trpcError({ code: "UNAUTHORIZED" })
      );
    });

    it("should throw an error if the new name is already taken by another plan", async () => {
      // create a 2nd plan
      const plan = { name: "Budget Tier", price: 10 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 1 });
      const response = await authenticatedUser.plans.create(plan);
      expect(response.success).toBe(true);
      // update the first plan with the 2nd's plan name
      const data = { id: 1, name: "Budget Tier", price: 10 };
      expect(authenticatedUser.plans.update(data)).rejects.toThrowError(
        new trpcError({ code: "BAD_REQUEST" })
      );
    });

    it("should throw an error if the new price is less than zero", async () => {
      const data = { id: 1, name: "New Name", price: -5 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 1 });
      expect(authenticatedUser.plans.update(data)).rejects.toThrowError(
        new trpcError({ code: "BAD_REQUEST" })
      );
    });

    it("should update the plan successfully", async () => {
      const data = { id: 1, name: "Free Tier", price: 0 };
      const authenticatedUser = await createAuthenticatedCaller({ userId: 1 });
      const response = await authenticatedUser.plans.update(data);
      expect(response.success).toBe(true);
    });
  });

  describe("get", async () => {
    it("should return a list of plans", async () => {
      const data = await createCaller({}).plans.get();
      const name = data.plans[0]?.name;
      const price = data.plans[0]?.price;
      expect(name).toEqual("Free Tier");
      expect(price).toEqual(0);
    });
  });

  describe("upgrade", async () => {
    it("should throw an error when passing non existing plan ID", async () => {
      const authenticatedUser = await createAuthenticatedCaller({ userId: 2 });
      expect(authenticatedUser.plans.upgrade({ id: -1 })).rejects.toThrowError(
        new trpcError({ code: "NOT_FOUND" })
      );
    });

    it("should calculate the plan upgrade price", async () => {
      const authenticatedUser = await createAuthenticatedCaller({ userId: 2 });
      const response = await authenticatedUser.plans.upgrade({ id: 2 });
      expect(response.price).toBeGreaterThanOrEqual(0);
    });
  });

  describe("subscribe", async () => {
    it("should cancel prev sub and add a new one", async () => {
      const authenticatedUser = await createAuthenticatedCaller({ userId: 2 });
      const response = await authenticatedUser.plans.subscribe({ id: 2 });
      expect(response.success).toBe(true);
    });
  });
});
