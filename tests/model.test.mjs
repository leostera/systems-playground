import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/model.ts";

test("external inflows and outflows change arbitrary stocks over time", () => {
  const points = simulate(
    [{ id: "water", initial: 60 }],
    [
      { id: "rain", rate: 8, targetStockId: "water" },
      { id: "drain", rate: 6, sourceStockId: "water" },
    ],
    [],
    10,
    1,
  );
  assert.equal(points[0].stocks.water, 60);
  assert.equal(points.at(-1).stocks.water, 80);
});

test("stocks never fall below zero when outflows exceed their level", () => {
  const points = simulate([{ id: "ore", initial: 5 }], [{ id: "mining", rate: 20, sourceStockId: "ore" }], [], 2, 1);
  assert.ok(points.every(({ stocks }) => stocks.ore >= 0));
  assert.equal(points.at(-1).stocks.ore, 0);
});

test("signed information links adjust the rate of a flow", () => {
  const stocks = [{ id: "water", initial: 100 }];
  const flows = [{ id: "drain", rate: 10, sourceStockId: "water" }];
  const positive = simulate(stocks, flows, [{ sourceStockId: "water", targetFlowId: "drain", polarity: 1 }], 2, 1);
  const negative = simulate(stocks, flows, [{ sourceStockId: "water", targetFlowId: "drain", polarity: -1 }], 2, 1);
  assert.equal(positive.at(-1).stocks.water, 81);
  assert.ok(negative.at(-1).stocks.water < positive.at(-1).stocks.water);
});

test("a fractional time horizon ends at the requested year", () => {
  const points = simulate([{ id: "stock", initial: 0 }], [{ id: "inflow", rate: 1, targetStockId: "stock" }], [], 1.1, 0.5);
  assert.equal(points.at(-1).year, 1.1);
  assert.equal(points.at(-1).stocks.stock, 1.1);
});
