const path = require("path");

describe("VibeAbilityIdHash", () => {
  const modulePath = path.resolve(__dirname, "../../public/shared/ability-id-hash.js");
  const protocolCodecsPath = path.resolve(__dirname, "../../public/shared/protocol-codecs.js");

  test("maps lowercase protocol hashes back to canonical camelCase ids", () => {
    const { registerAbilityIdHash, hashAbilityId } = require(modulePath);
    const { hashString32 } = require(protocolCodecsPath);
    const byHash = new Map();

    registerAbilityIdHash(byHash, "aimedShot", "aimedShot", hashString32);
    registerAbilityIdHash(byHash, "poisonArrow", "poisonArrow", hashString32);

    expect(byHash.get(hashAbilityId("aimedshot", hashString32))).toBe("aimedShot");
    expect(byHash.get(hashAbilityId("aimedShot", hashString32))).toBe("aimedShot");
    expect(byHash.get(hashAbilityId("poisonarrow", hashString32))).toBe("poisonArrow");
    expect(byHash.get(hashAbilityId("poisonArrow", hashString32))).toBe("poisonArrow");
  });

  test("keeps lowercase ids stable", () => {
    const { registerAbilityIdHash, hashAbilityId } = require(modulePath);
    const { hashString32 } = require(protocolCodecsPath);
    const byHash = new Map();

    registerAbilityIdHash(byHash, "fireball", "fireball", hashString32);

    expect(byHash.get(hashAbilityId("fireball", hashString32))).toBe("fireball");
  });
});
