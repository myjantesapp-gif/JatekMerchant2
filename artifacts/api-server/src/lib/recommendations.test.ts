import assert from "node:assert/strict";
import test from "node:test";

import { selectAvailableRecommendations, type AvailableProductCandidate } from "./recommendations";

function candidate(id: number, restaurantId: number, isPopular = false): AvailableProductCandidate & { isPopular: boolean } {
  return {
    id,
    restaurantId,
    imageUrl: `/images/${id}.jpg`,
    isPopular,
  };
}

test("Home recommendations prefer one live catalog product per merchant", () => {
  const rows = [
    candidate(1, 10, true),
    candidate(2, 10, false),
    candidate(3, 11, false),
    candidate(4, 12, true),
  ];

  assert.deepEqual(
    selectAvailableRecommendations(rows, 3).map((row) => row.id),
    [1, 3, 4],
  );
});

test("Home recommendations fill remaining slots without using popularity", () => {
  const rows = [
    candidate(1, 10, false),
    candidate(2, 10, true),
    candidate(3, 10, true),
  ];

  assert.deepEqual(
    selectAvailableRecommendations(rows, 3).map((row) => row.id),
    [1, 2, 3],
  );
});

test("Home recommendations clamp the response to the server limit", () => {
  const rows = Array.from({ length: 20 }, (_, index) => candidate(index + 1, index + 1));

  assert.equal(selectAvailableRecommendations(rows, 100).length, 12);
  assert.equal(selectAvailableRecommendations(rows, 0).length, 1);
});