import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANVIL_CHAIN_ID, assertChainConfig, chainIdFromHex, probeEvmChainId } from "./allowlist.js";

const local = {
  evmRpcUrl: "http://127.0.0.1:8545",
  solanaRpcUrl: "http://127.0.0.1:8899",
  evmChainId: ANVIL_CHAIN_ID,
};

describe("chain allowlist", () => {
  it("accepts local Anvil and solana-test-validator", () => {
    assert.doesNotThrow(() => assertChainConfig(local));
    assert.doesNotThrow(() =>
      assertChainConfig({
        evmRpcUrl: "http://localhost:8545/",
        solanaRpcUrl: "http://solana:8899",
        evmChainId: 31337,
      }),
    );
    assert.doesNotThrow(() =>
      assertChainConfig({
        evmRpcUrl: "http://anvil:8545",
        solanaRpcUrl: "http://localhost:8899",
        evmChainId: 31337,
      }),
    );
  });

  it("refuses public RPCs and any chain id other than 31337", () => {
    for (const evmRpcUrl of [
      "https://sepolia.infura.io/v3/abc",
      "https://mainnet.infura.io/v3/abc",
      "https://eth.llamarpc.com",
      "http://127.0.0.1:8545?key=secret",
    ]) {
      assert.throws(() => assertChainConfig({ ...local, evmRpcUrl }), /Anvil|credentials|query|valid URL/);
    }
    assert.throws(() => assertChainConfig({ ...local, solanaRpcUrl: "https://api.mainnet-beta.solana.com" }), /solana/);
    assert.throws(() => assertChainConfig({ ...local, evmChainId: 1 }), /31337/);
    assert.throws(() => assertChainConfig({ ...local, evmChainId: 11155111 }), /31337/);
  });

  it("reads Anvil's chain id hex", () => {
    assert.equal(chainIdFromHex("0x7a69"), 31337);
    assert.equal(chainIdFromHex("0x1"), 1);
  });

  it("does not probe a public RPC", async () => {
    let called = false;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error("should not fetch");
    }) as typeof fetch;
    try {
      await assert.rejects(() => probeEvmChainId("https://eth.llamarpc.com"), /Anvil/);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = original;
    }
  });
});
