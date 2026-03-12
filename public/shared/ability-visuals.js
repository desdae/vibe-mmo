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
      summon: {
        iconRenderer: "fire_hydra",
        areaEffectRenderer: "fire_hydra",
        castPreviewRenderer: "fire_hydra"
      },
      selfbuff: {
        iconRenderer: "blood_wrath"
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
      fireshard: {
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
      firehydra: {
        iconRenderer: "fire_hydra",
        areaEffectRenderer: "fire_hydra",
        castPreviewRenderer: "fire_hydra"
      },
      aimedshot: {
        iconRenderer: "aimed_shot",
        projectileRenderer: "ranger_arrow"
      },
      multishot: {
        iconRenderer: "multishot",
        projectileRenderer: "ranger_arrow"
      },
      poisonarrow: {
        iconRenderer: "poison_arrow",
        projectileRenderer: "poison_arrow"
      },
      explosivearrow: {
        iconRenderer: "explosive_arrow",
        projectileRenderer: "explosive_arrow"
      },
      shrapnelgrenade: {
        iconRenderer: "shrapnel_grenade",
        projectileRenderer: "shrapnel_grenade"
      },
      shrapnelshard: {
        iconRenderer: "shrapnel_grenade",
        projectileRenderer: "shrapnel_shard"
      },
      rainofarrows: {
        iconRenderer: "rain_of_arrows",
        areaEffectRenderer: "rain_of_arrows",
        castPreviewRenderer: "target_circle"
      },
      caltrops: {
        iconRenderer: "caltrops",
        areaEffectRenderer: "caltrops",
        castPreviewRenderer: "target_circle"
      },
      ricochetshot: {
        iconRenderer: "ricochet_shot",
        areaEffectRenderer: "ricochet_shot"
      },
      ballistanest: {
        iconRenderer: "ballista_nest",
        areaEffectRenderer: "ballista_nest",
        castPreviewRenderer: "ballista_nest"
      },
      ballistabolt: {
        iconRenderer: "ballista_nest",
        projectileRenderer: "ballista_bolt"
      },
      piercingbolt: {
        iconRenderer: "piercing_bolt",
        areaEffectRenderer: "piercing_bolt"
      },
      hydrafireshard: {
        iconRenderer: "fire_hydra",
        projectileRenderer: "fire_spark"
      },
      blink: {
        iconRenderer: "blink"
      },
      bloodwrath: {
        iconRenderer: "blood_wrath"
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
