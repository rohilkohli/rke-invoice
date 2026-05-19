import assert from "node:assert/strict";
import test from "node:test";

import { hasAllRequestedIdsAuthorized } from "../lib/authorization";

test("allows request when all invoice ids are authorized", () => {
  assert.equal(hasAllRequestedIdsAuthorized([1, 2], [2, 1, 3]), true);
});

test("denies request when any requested id is unauthorized", () => {
  assert.equal(hasAllRequestedIdsAuthorized([1, 2, 4], [1, 2, 3]), false);
});

test("denies empty request", () => {
  assert.equal(hasAllRequestedIdsAuthorized([], [1]), false);
});

