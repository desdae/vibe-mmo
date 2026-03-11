(function initAbilityVisualRegistry(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeAbilityVisualRegistry = rootFactory();
})(function buildAbilityVisualRegistry() {
  const registry = {
    defaultVisuals: {
      iconRenderer: "unknown",
      projectileRenderer: "default",
      areaEffectRenderer: "",
      castPreviewRenderer: ""
    },
    byKind: {
      meleecone: {
        iconRenderer: "melee_slash"
      },
      projectile: {
        iconRenderer: "fireball",
        projectileRenderer: "fireball"
      },
      area: {
        iconRenderer: "warstomp"
      },
      beam: {
        iconRenderer: "arcane_beam",
        areaEffectRenderer: "arcane_beam"
      },
      chain: {
        iconRenderer: "lightning_beam",
        areaEffectRenderer: "lightning_beam"
      },
      teleport: {
        iconRenderer: "blink"
      }
    },
    byId: {
      none: {
        iconRenderer: "unknown"
      },
      pickup_bag: {
        iconRenderer: "pickup_bag"
      },
      slash: {
        iconRenderer: "melee_slash"
      },
      fireball: {
        iconRenderer: "fireball",
        projectileRenderer: "fireball"
      },
      fireball_pulse_shard: {
        iconRenderer: "fireball",
        projectileRenderer: "fire_spark"
      },
      frostbolt: {
        iconRenderer: "frostbolt",
        projectileRenderer: "frostbolt"
      },
      arcanemissiles: {
        iconRenderer: "arcane_missiles",
        projectileRenderer: "arcane_missiles"
      },
      blizzard: {
        iconRenderer: "blizzard",
        areaEffectRenderer: "blizzard",
        castPreviewRenderer: "blizzard"
      },
      arcanebeam: {
        iconRenderer: "arcane_beam",
        areaEffectRenderer: "arcane_beam"
      },
      lightningbeam: {
        iconRenderer: "lightning_beam",
        areaEffectRenderer: "lightning_beam"
      },
      chainlightning: {
        iconRenderer: "lightning_beam",
        areaEffectRenderer: "lightning_beam"
      },
      blink: {
        iconRenderer: "blink"
      },
      warstomp: {
        iconRenderer: "warstomp"
      },
      bonearrow: {
        iconRenderer: "melee_slash",
        projectileRenderer: "bone_arrow"
      },
      mobmeleeswing: {
        iconRenderer: "melee_slash"
      }
    }
  };

  return Object.freeze(registry);
});
