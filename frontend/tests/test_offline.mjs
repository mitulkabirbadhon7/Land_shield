import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read test vector fixture
const fixturePath = path.join(__dirname, "fixtures", "offline_vector.json");
const vector = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

// Import compiled or transpile test of offline verification
async function runTests() {
  console.log("Starting Offline Verification Test Suite...");

  // Dynamically import compiled offlineVerify or test logic directly
  const { verifyOffline } = await import("../src/lib/offlineVerify.ts");

  // Test 1: Valid Deed -> AUTHENTIC
  console.log("Test 1: Valid deed payload...");
  const validRes = await verifyOffline(vector.valid.payload_b64, vector.keys);
  assert.strictEqual(validRes.state, "AUTHENTIC", "Valid payload must verify as AUTHENTIC");
  assert.strictEqual(validRes.fields.deed_no, vector.valid.deed_no, "Deed number must match");
  assert.strictEqual(validRes.fields.area_sold, vector.valid.area_sold, "Area sold must match");
  console.log("✓ Test 1 Passed: AUTHENTIC verified with Ed25519 signature & SHA-256");

  // Test 2: Tampered Deed -> NOT_AUTHENTIC (HASH_MISMATCH)
  console.log("Test 2: Tampered deed payload (area modified)...");
  const tamperedRes = await verifyOffline(vector.tampered.payload_b64, vector.keys);
  assert.strictEqual(tamperedRes.state, "NOT_AUTHENTIC", "Tampered payload must fail as NOT_AUTHENTIC");
  assert.strictEqual(tamperedRes.error, "HASH_MISMATCH", "Failure reason must be HASH_MISMATCH");
  console.log("✓ Test 2 Passed: NOT_AUTHENTIC caught hash mismatch");

  // Test 3: Unknown Key ID -> KEY_UNKNOWN
  console.log("Test 3: Unknown key ID payload...");
  const unknownKeyRes = await verifyOffline(vector.unknown_key.payload_b64, vector.keys);
  assert.strictEqual(unknownKeyRes.state, "KEY_UNKNOWN", "Unknown key must return KEY_UNKNOWN");
  console.log("✓ Test 3 Passed: KEY_UNKNOWN correctly reported");

  // Test 4: Raw JSON string support
  console.log("Test 4: Raw JSON string decoding...");
  const rawJsonRes = await verifyOffline(vector.valid.raw_json, vector.keys);
  assert.strictEqual(rawJsonRes.state, "AUTHENTIC", "Raw JSON string must verify as AUTHENTIC");
  console.log("✓ Test 4 Passed: Raw JSON verified directly");

  console.log("\nALL 4 OFFLINE VERIFY UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
