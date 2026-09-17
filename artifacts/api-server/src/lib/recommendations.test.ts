import assert from "node:assert/strict";
import test from "node:test";

import {
  selectAvailableRecommendations,
  selectNewestRecommendations,
  type AvailableProductCandidate,
} from "./recommendations";

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

test("Home recommendations preserve the catalog order while diversifying merchants", () => {
  const rows = [
    candidate(10, 10),
    candidate(20, 11),
    candidate(11, 10),
    candidate(21, 11),
  ];

  // The route supplies candidates in saved category/product order.
  // Diversity may skip a merchant's later product during the first pass, but
  // it must never move a later catalog entry ahead of an earlier one.
  assert.deepEqual(
    selectAvailableRecommendations(rows, 4).map((row) => row.id),
    [10, 20, 11, 21],
  );
});

test("Home recommendations keep skipped same-merchant products in catalog order when filling", () => {
  const rows = [
    candidate(10, 10),
    candidate(11, 10),
    candidate(20, 20),
  ];

  assert.deepEqual(
    selectAvailableRecommendations(rows, 3).map((row) => row.id),
    [10, 11, 20],
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

test("Newest recommendations preserve the recency order across merchants", () => {
  const rows = [
    candidate(30, 10),
    candidate(29, 10),
    candidate(28, 11),
  ];

  assert.deepEqual(
    selectNewestRecommendations(rows, 2).map((row) => row.id),
    [30, 29],
  );
});