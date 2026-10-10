import test from "node:test";
import assert from "node:assert/strict";
import { simulate, DEFAULT_PARAMETERS } from "../src/model.ts";

test("simulation includes the initial state and reaches the configured horizon", () => {
  const points = simulate(DEFAULT_PARAMETERS);
  assert.equal(points[0].year, 0);
  assert.equal(points[0].population, DEFAULT_PARAMETERS.population);
  assert.equal(points.at(-1).year, DEFAULT_PARAMETERS.years);
});

test("stocks stay within their physical bounds", () => {
  const points = simulate({ ...DEFAULT_PARAMETERS, consumptionPerPerson: 100, birthRate: 0.2 });
  assert.ok(points.every(({ population, resource }) => population >= 0 && resource >= 0));
  assert.ok(points.every(({ resource }) => resource <= DEFAULT_PARAMETERS.capacity));
});
