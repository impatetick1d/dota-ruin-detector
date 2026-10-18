/**
 * analyzer.js (v4.3 — Draft-Aware Build & Timing Evaluator + Match Chronology + Complete Item Icons DB)
 *
 * Ключевые исправления v4.2:
 * 1. Полная база предметов ITEMS_DB (250+ ID, включая компоненты #21 Ogre Axe, #178 Soul Ring и все новые предметы
 *    патчей 7.33–7.41+: Harpoon, Disperser, Khanda, Phylactery, Parasma, Gleipnir, Mage Slayer, Eternal Shroud,
 *    Pavise, Blood Grenade, Overwhelming/Swift/Arcane Blink, Wind Waker и др.) + динамическая синхронизация
 *    с эндпоинтом OpenDota /api/constants/items.
 * 2. Защита от ложного бонуса за «один случайный замес» (кейс АФК-Бруды 4/7/3 с 11.7k урона и 1.0k тавер-дамага):
 *    - Бонус «Боец до последнего» и списание очков вины больше НЕ выдаются за один файт, если в целом за матч
 *      кор-игрок имел низкий КПД урона (Damage per Gold < 1.00) или уклонялся от драк (Драки < 45%).
 * 3. Детектор «АФК-фарм на кор-позиции (Pos 1–3)» и учет пуш-героев (Broodmother, Lycan, Beastmaster, NP, TB и др.):
 *    - Если кор-герой участвовал менее чем в 45% драк команды и нанес мало урона за золото (< 0.90), он получает
 *      штраф в «⚔️ Импакт в драках» за пассивный фарм карты.
 *    - Для пуш-коров (Broodmother и др.) минимальный порог урона по башням за 30+ минут повышен до 2500 ед.
 *      (а для остальных физических коров — до 1500 ед. при участии в драках < 45%).
 * 4. Честный расчет «Отыгрыша на герое»: высокий GPM/XPM от АФК-фарма больше не завышает перцентиль полезности,
 *    если урон по героям и башням провален.
 */

const HEROES_DB = {
  1: { name: 'Anti-Mage', isSupport: false, jungleBias: 0.12, bigUlt: 'antimage_mana_void', ultLabel: 'Mana Void', ultCd: 70 },
  2: { name: 'Axe', isSupport: false, spellcaster: true, jungleBias: 0.10, bigUlt: 'axe_culling_blade', ultLabel: 'Culling Blade', ultCd: 75 },
  3: { name: 'Bane', isSupport: true, bigUlt: 'bane_fiends_grip', ultLabel: "Fiend's Grip", ultCd: 110 },
  4: { name: 'Bloodseeker', isSupport: false, jungleBias: 0.06, bigUlt: 'bloodseeker_rupture', ultLabel: 'Rupture', ultCd: 70 },
  5: { name: 'Crystal Maiden', isSupport: true },
  6: { name: 'Drow Ranger', isSupport: false, pusher: true, jungleBias: 0.05 },
  7: { name: 'Earthshaker', isSupport: true, spellcaster: true, bigUlt: 'earthshaker_echo_slam', ultLabel: 'Echo Slam', ultCd: 110 },
  8: { name: 'Juggernaut', isSupport: false, pusher: true, jungleBias: 0.08, bigUlt: 'juggernaut_omni_slash', ultLabel: 'Omnislash', ultCd: 120 },
  9: { name: 'Mirana', isSupport: true },
  10: { name: 'Morphling', isSupport: false, pusher: true, jungleBias: 0.06 },
  11: { name: 'Shadow Fiend', isSupport: false, pusher: true, jungleBias: 0.08, bigUlt: 'nevermore_requiem', ultLabel: 'Requiem of Souls', ultCd: 100 },
  12: { name: 'Phantom Lancer', isSupport: false, jungleBias: 0.12 },
  13: { name: 'Puck', isSupport: false, spellcaster: true, bigUlt: 'puck_dream_coil', ultLabel: 'Dream Coil', ultCd: 75 },
  14: { name: 'Pudge', isSupport: true, spellcaster: true },
  15: { name: 'Razor', isSupport: false, bigUlt: 'razor_eye_of_the_storm', ultLabel: 'Eye of the Storm', ultCd: 80 },
  16: { name: 'Sand King', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'sandking_epicenter', ultLabel: 'Epicenter', ultCd: 110 },
  17: { name: 'Storm Spirit', isSupport: false, spellcaster: true, jungleBias: 0.06 },
  18: { name: 'Sven', isSupport: false, jungleBias: 0.16, bigUlt: 'sven_gods_strength', ultLabel: "God's Strength", ultCd: 105 },
  19: { name: 'Tiny', isSupport: false, pusher: true, jungleBias: 0.06 },
  20: { name: 'Vengeful Spirit', isSupport: true },
  21: { name: 'Windranger', isSupport: false, pusher: true, bigUlt: 'windrunner_focusfire', ultLabel: 'Focus Fire', ultCd: 50 },
  22: { name: 'Zeus', isSupport: false, spellcaster: true, bigUlt: 'zuus_thundergods_wrath', ultLabel: "Thundergod's Wrath", ultCd: 120 },
  23: { name: 'Kunkka', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'kunkka_ghostship', ultLabel: 'Ghostship', ultCd: 70 },
  25: { name: 'Lina', isSupport: false, jungleBias: 0.06, bigUlt: 'lina_laguna_blade', ultLabel: 'Laguna Blade', ultCd: 60 },
  26: { name: 'Lion', isSupport: true, bigUlt: 'lion_finger_of_death', ultLabel: 'Finger of Death', ultCd: 100 },
  27: { name: 'Shadow Shaman', isSupport: true, pusher: true, bigUlt: 'shadow_shaman_mass_serpent_ward', ultLabel: 'Mass Serpent Ward', ultCd: 110 },
  28: { name: 'Slardar', isSupport: false },
  29: { name: 'Tidehunter', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'tidehunter_ravage', ultLabel: 'Ravage', ultCd: 150 },
  30: { name: 'Witch Doctor', isSupport: true, bigUlt: 'witch_doctor_death_ward', ultLabel: 'Death Ward', ultCd: 75 },
  31: { name: 'Lich', isSupport: true, bigUlt: 'lich_chain_frost', ultLabel: 'Chain Frost', ultCd: 80 },
  32: { name: 'Riki', isSupport: false, spellcaster: true, jungleBias: -0.10 },
  33: { name: 'Enigma', isSupport: false, spellcaster: true, jungleBias: 0.14, bigUlt: 'enigma_black_hole', ultLabel: 'Black Hole', ultCd: 180 },
  34: { name: 'Tinker', isSupport: false, spellcaster: true, jungleBias: 0.08 },
  35: { name: 'Sniper', isSupport: false, pusher: true, jungleBias: 0.05 },
  36: { name: 'Necrophos', isSupport: false, spellcaster: true, bigUlt: 'necrolyte_reapers_scythe', ultLabel: "Reaper's Scythe", ultCd: 110 },
  37: { name: 'Warlock', isSupport: true, bigUlt: 'warlock_rain_of_chaos', ultLabel: 'Chaotic Offering', ultCd: 160 },
  38: { name: 'Beastmaster', isSupport: false, pusher: true, jungleBias: 0.10, bigUlt: 'beastmaster_primal_roar', ultLabel: 'Primal Roar', ultCd: 80 },
  39: { name: 'Queen of Pain', isSupport: false, spellcaster: true, bigUlt: 'queenofpain_sonic_wave', ultLabel: 'Sonic Wave', ultCd: 110 },
  40: { name: 'Venomancer', isSupport: true, jungleBias: 0.10, bigUlt: 'venomancer_noxious_plague', ultLabel: 'Noxious Plague', ultCd: 100 },
  41: { name: 'Faceless Void', isSupport: false, jungleBias: 0.08, bigUlt: 'faceless_void_chronosphere', ultLabel: 'Chronosphere', ultCd: 140 },
  42: { name: 'Wraith King', isSupport: false, pusher: true, jungleBias: 0.15 },
  43: { name: 'Death Prophet', isSupport: false, pusher: true, bigUlt: 'death_prophet_exorcism', ultLabel: 'Exorcism', ultCd: 140 },
  44: { name: 'Phantom Assassin', isSupport: false, jungleBias: 0.10 },
  45: { name: 'Pugna', isSupport: true, pusher: true },
  46: { name: 'Templar Assassin', isSupport: false, pusher: true, jungleBias: 0.14 },
  47: { name: 'Viper', isSupport: false, bigUlt: 'viper_viper_strike', ultLabel: 'Viper Strike', ultCd: 50 },
  48: { name: 'Luna', isSupport: false, pusher: true, jungleBias: 0.16, bigUlt: 'luna_eclipse', ultLabel: 'Eclipse', ultCd: 110 },
  49: { name: 'Dragon Knight', isSupport: false, pusher: true, jungleBias: 0.06, bigUlt: 'dragon_knight_elder_dragon_form', ultLabel: 'Elder Dragon Form', ultCd: 105 },
  50: { name: 'Dazzle', isSupport: true },
  51: { name: 'Clockwerk', isSupport: true, spellcaster: true, bigUlt: 'rattletrap_hookshot', ultLabel: 'Hookshot', ultCd: 55 },
  52: { name: 'Leshrac', isSupport: false, pusher: true },
  53: { name: "Nature's Prophet", isSupport: false, pusher: true, jungleBias: 0.14 },
  54: { name: 'Lifestealer', isSupport: false, jungleBias: 0.10 },
  55: { name: 'Dark Seer', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'dark_seer_wall_of_replica', ultLabel: 'Wall of Replica', ultCd: 100 },
  56: { name: 'Clinkz', isSupport: false, pusher: true },
  57: { name: 'Omniknight', isSupport: true, spellcaster: true, bigUlt: 'omniknight_guardian_angel', ultLabel: 'Guardian Angel', ultCd: 120 },
  58: { name: 'Enchantress', isSupport: true, jungleBias: 0.12 },
  59: { name: 'Huskar', isSupport: false, jungleBias: 0.08 },
  60: { name: 'Night Stalker', isSupport: false, bigUlt: 'night_stalker_darkness', ultLabel: 'Dark Ascension', ultCd: 130 },
  61: { name: 'Broodmother', isSupport: false, pusher: true, jungleBias: 0.12 },
  62: { name: 'Bounty Hunter', isSupport: true, spellcaster: true },
  63: { name: 'Weaver', isSupport: false },
  64: { name: 'Jakiro', isSupport: true, pusher: true, bigUlt: 'jakiro_macropyre', ultLabel: 'Macropyre', ultCd: 70 },
  65: { name: 'Batrider', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'batrider_flaming_lasso', ultLabel: 'Flaming Lasso', ultCd: 100 },
  66: { name: 'Chen', isSupport: true, pusher: true, jungleBias: 0.18, bigUlt: 'chen_hand_of_god', ultLabel: 'Hand of God', ultCd: 130 },
  67: { name: 'Spectre', isSupport: false, spellcaster: true, jungleBias: 0.08 },
  68: { name: 'Ancient Apparition', isSupport: true },
  69: { name: 'Doom', isSupport: false, spellcaster: true, jungleBias: 0.12, bigUlt: 'doom_bringer_doom', ultLabel: 'Doom', ultCd: 135 },
  70: { name: 'Ursa', isSupport: false, jungleBias: 0.12, bigUlt: 'ursa_enrage', ultLabel: 'Enrage', ultCd: 50 },
  71: { name: 'Spirit Breaker', isSupport: true, spellcaster: true, bigUlt: 'spirit_breaker_nether_strike', ultLabel: 'Nether Strike', ultCd: 70 },
  72: { name: 'Gyrocopter', isSupport: false, jungleBias: 0.14, bigUlt: 'gyrocopter_call_down', ultLabel: 'Call Down', ultCd: 75 },
  73: { name: 'Alchemist', isSupport: false, jungleBias: 0.18 },
  74: { name: 'Invoker', isSupport: false, spellcaster: true, bigUlt: 'invoker_deafening_blast', ultLabel: 'Deafening Blast', ultCd: 40 },
  75: { name: 'Silencer', isSupport: true, bigUlt: 'silencer_global_silence', ultLabel: 'Global Silence', ultCd: 130 },
  76: { name: 'Outworld Destroyer', isSupport: false, spellcaster: true, bigUlt: 'obsidian_destroyer_sanity_eclipse', ultLabel: "Sanity's Eclipse", ultCd: 140 },
  77: { name: 'Lycan', isSupport: false, pusher: true, jungleBias: 0.12 },
  78: { name: 'Brewmaster', isSupport: false, bigUlt: 'brewmaster_primal_split', ultLabel: 'Primal Split', ultCd: 130 },
  79: { name: 'Shadow Demon', isSupport: true },
  80: { name: 'Lone Druid', isSupport: false, pusher: true, jungleBias: 0.10 },
  81: { name: 'Chaos Knight', isSupport: false, jungleBias: 0.08, bigUlt: 'chaos_knight_phantasm', ultLabel: 'Phantasm', ultCd: 75 },
  82: { name: 'Meepo', isSupport: false, pusher: true, jungleBias: 0.18 },
  83: { name: 'Treant Protector', isSupport: true, bigUlt: 'treant_overgrowth', ultLabel: 'Overgrowth', ultCd: 110 },
  84: { name: 'Ogre Magi', isSupport: true },
  85: { name: 'Undying', isSupport: true },
  86: { name: 'Rubick', isSupport: true },
  87: { name: 'Disruptor', isSupport: true, bigUlt: 'disruptor_static_storm', ultLabel: 'Static Storm', ultCd: 80 },
  88: { name: 'Nyx Assassin', isSupport: true, spellcaster: true },
  89: { name: 'Naga Siren', isSupport: false, pusher: true, jungleBias: 0.18 },
  90: { name: 'Keeper of the Light', isSupport: true, spellcaster: true },
  91: { name: 'Io', isSupport: true },
  92: { name: 'Visage', isSupport: false, pusher: true },
  93: { name: 'Slark', isSupport: false, jungleBias: 0.06, bigUlt: 'slark_shadow_dance', ultLabel: 'Shadow Dance', ultCd: 60 },
  94: { name: 'Medusa', isSupport: false, pusher: true, jungleBias: 0.18, bigUlt: 'medusa_stone_gaze', ultLabel: 'Stone Gaze', ultCd: 90 },
  95: { name: 'Troll Warlord', isSupport: false, pusher: true, jungleBias: 0.12, bigUlt: 'troll_warlord_battle_trance', ultLabel: 'Battle Trance', ultCd: 80 },
  96: { name: 'Centaur Warrunner', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'centaur_stampede', ultLabel: 'Stampede', ultCd: 90 },
  97: { name: 'Magnus', isSupport: false, spellcaster: true, jungleBias: 0.08, bigUlt: 'magnataur_reverse_polarity', ultLabel: 'Reverse Polarity', ultCd: 120 },
  98: { name: 'Timbersaw', isSupport: false, spellcaster: true },
  99: { name: 'Bristleback', isSupport: false, spellcaster: true, jungleBias: 0.08 },
  100: { name: 'Tusk', isSupport: true },
  101: { name: 'Skywrath Mage', isSupport: true, spellcaster: true, bigUlt: 'skywrath_mage_mystic_flare', ultLabel: 'Mystic Flare', ultCd: 40 },
  102: { name: 'Abaddon', isSupport: true },
  103: { name: 'Elder Titan', isSupport: true, bigUlt: 'elder_titan_earth_splitter', ultLabel: 'Earth Splitter', ultCd: 100 },
  104: { name: 'Legion Commander', isSupport: false, jungleBias: 0.08, bigUlt: 'legion_commander_duel', ultLabel: 'Duel', ultCd: 50 },
  105: { name: 'Techies', isSupport: true, spellcaster: true },
  106: { name: 'Ember Spirit', isSupport: false, spellcaster: true },
  107: { name: 'Earth Spirit', isSupport: true, spellcaster: true, bigUlt: 'earth_spirit_magnetize', ultLabel: 'Magnetize', ultCd: 90 },
  108: { name: 'Underlord', isSupport: false, spellcaster: true },
  109: { name: 'Terrorblade', isSupport: false, pusher: true, jungleBias: 0.16, bigUlt: 'terrorblade_sunder', ultLabel: 'Sunder', ultCd: 80 },
  110: { name: 'Phoenix', isSupport: true, spellcaster: true, bigUlt: 'phoenix_supernova', ultLabel: 'Supernova', ultCd: 110 },
  111: { name: 'Oracle', isSupport: true, bigUlt: 'oracle_false_promise', ultLabel: 'False Promise', ultCd: 90 },
  112: { name: 'Winter Wyvern', isSupport: true, bigUlt: 'winter_wyvern_winters_curse', ultLabel: "Winter's Curse", ultCd: 85 },
  113: { name: 'Arc Warden', isSupport: false, pusher: true, jungleBias: 0.10 },
  114: { name: 'Monkey King', isSupport: false, bigUlt: 'monkey_king_wukongs_command', ultLabel: "Wukong's Command", ultCd: 100 },
  119: { name: 'Dark Willow', isSupport: true, bigUlt: 'dark_willow_terrorize', ultLabel: 'Terrorize', ultCd: 90 },
  120: { name: 'Pangolier', isSupport: false, spellcaster: true, bigUlt: 'pangolier_gyroshell', ultLabel: 'Rolling Thunder', ultCd: 80 },
  121: { name: 'Grimstroke', isSupport: true, bigUlt: 'grimstroke_soul_chain', ultLabel: 'Soulbind', ultCd: 75 },
  123: { name: 'Hoodwink', isSupport: true },
  126: { name: 'Void Spirit', isSupport: false, spellcaster: true },
  128: { name: 'Snapfire', isSupport: true, bigUlt: 'snapfire_mortimer_kisses', ultLabel: 'Mortimer Kisses', ultCd: 110 },
  129: { name: 'Mars', isSupport: false, spellcaster: true, bigUlt: 'mars_arena_of_blood', ultLabel: 'Arena of Blood', ultCd: 90 },
  131: { name: 'Ringmaster', isSupport: true, bigUlt: 'ringmaster_wheel', ultLabel: 'Wheel of Wonder', ultCd: 90 },
  135: { name: 'Dawnbreaker', isSupport: false, spellcaster: true, bigUlt: 'dawnbreaker_solar_guardian', ultLabel: 'Solar Guardian', ultCd: 110 },
  136: { name: 'Marci', isSupport: true },
  137: { name: 'Primal Beast', isSupport: false, spellcaster: true, bigUlt: 'primal_beast_pulverize', ultLabel: 'Pulverize', ultCd: 36 },
  138: { name: 'Muerta', isSupport: false, jungleBias: 0.08, bigUlt: 'muerta_pierce_the_veil', ultLabel: 'Pierce the Veil', ultCd: 60 },
  145: { name: 'Kez', isSupport: false, bigUlt: 'kez_raptor_dance', ultLabel: 'Raptor Dance', ultCd: 65 },
  146: { name: 'Largo', isSupport: false, spellcaster: true, bigUlt: 'largo_ult', ultLabel: 'Largo Ultimate', ultCd: 90 }
};

// Динамические кэши способностей и популярности предметов из OpenDota API и STRATZ GraphQL API
const ABILITIES_DB = {};
const HERO_ITEM_POPULARITY_CACHE = {};

const DEFAULT_STRATZ_API_TOKEN =
  (typeof process !== "undefined" && process.env && process.env.STRATZ_API_TOKEN) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJTdWJqZWN0IjoiNWYwM2RjNzQtNTYyNy00NTE5LTlkMTktZjM0ZmY2MzRkMTM0IiwiU3RlYW1JZCI6IjE5MjE0MDYyMjUiLCJBUElVc2VyIjoidHJ1ZSIsIm5iZiI6MTc4Mzc0MDY4NywiZXhwIjoxODE1Mjc2Njg3LCJpYXQiOjE3ODM3NDA2ODcsImlzcyI6Imh0dHBzOi8vYXBpLnN0cmF0ei5jb20ifQ.F3hGA3hjHn1iSbX7zW0d102JA8AVfZx0apIJrAQLU_8";

// Герои дальнего боя (Ranged) для детекции анти-синергий (например Battle Fury / Echo Sabre / Harpoon на дальнике)
const RANGED_HERO_IDS = new Set([
  3, 5, 6, 9, 10, 11, 13, 15, 17, 20, 21, 22, 25, 26, 27, 30, 31, 33, 34, 35, 36, 37,
  39, 40, 43, 45, 46, 47, 48, 50, 52, 53, 56, 58, 59, 63, 64, 65, 66, 68, 72, 74, 75,
  76, 79, 84, 86, 87, 90, 91, 92, 94, 101, 105, 110, 111, 112, 113, 119, 121, 123, 128, 131, 138
]);

// Актуальная база метовых сборок патча 7.41+ (STRATZ / Pro Tracker / OpenDota baseline) для каждого героя,
// включая как физические, так и магические ветки раскачки (например SF физ и SF маг)
const HERO_CURATED_META_ITEMS = {
  1: [145, 147, 116, 139, 208, 160, 225, 135, 156, 1097], // Anti-Mage
  2: [1, 127, 116, 90, 108, 119, 226, 114, 600],          // Axe
  6: [263, 147, 116, 139, 141, 156, 249, 108, 135, 160],  // Drow Ranger
  8: [145, 158, 147, 139, 225, 135, 208, 108, 603, 160, 156], // Juggernaut
  10: [147, 116, 160, 139, 156, 141, 135, 123, 1107],     // Morphling
  11: [172, 263, 147, 116, 141, 139, 156, 249, 135, 160, 603, 1, 100, 108, 604, 110, 235], // Shadow Fiend (Физ + Маг мета)
  12: [174, 1097, 147, 108, 114, 160, 139, 250, 208],     // Phantom Lancer
  13: [534, 597, 1, 100, 610, 108, 1466, 158, 141, 235, 96], // Puck
  17: [534, 259, 98, 250, 116, 96, 119, 123, 108, 597],   // Storm Spirit
  18: [172, 939, 1, 116, 141, 112, 156, 225, 135, 249],   // Sven
  19: [1, 252, 939, 116, 1107, 141, 112, 249, 108],       // Tiny
  21: [166, 1466, 158, 116, 108, 141, 135, 250, 225, 123], // Windranger
  22: [1100, 108, 232, 235, 110, 259, 96, 610],           // Zeus
  25: [166, 1466, 116, 263, 141, 156, 249, 135, 108, 232, 1107, 235], // Lina (Физ + Маг мета)
  32: [174, 1097, 147, 108, 225, 141, 116, 208, 135],     // Riki
  35: [172, 263, 158, 116, 141, 249, 135, 156, 160, 108], // Sniper
  36: [137, 692, 119, 108, 114, 226, 90, 610, 121],       // Necrophos
  39: [534, 259, 116, 108, 119, 96, 123, 597, 158],       // Queen of Pain
  41: [172, 158, 147, 116, 160, 139, 135, 156, 110, 108], // Faceless Void
  42: [151, 137, 1, 116, 112, 208, 939, 249, 225, 135],   // Wraith King
  44: [145, 168, 116, 208, 156, 225, 135, 108, 147],      // Phantom Assassin
  46: [168, 1, 116, 263, 141, 225, 135, 139, 156],        // Templar Assassin
  48: [172, 147, 116, 139, 141, 156, 160, 135, 108, 1107], // Luna
  49: [172, 158, 1, 116, 141, 112, 249, 108, 156, 135],   // Dragon Knight
  52: [121, 692, 116, 119, 259, 108, 610, 96],            // Leshrac
  53: [166, 1466, 158, 116, 250, 249, 141, 135, 156, 96, 225], // Nature's Prophet
  54: [151, 137, 154, 147, 108, 208, 156, 225, 135, 112, 158], // Lifestealer
  56: [168, 98, 250, 116, 141, 225, 135, 263, 96],        // Clinkz
  59: [151, 116, 154, 210, 156, 108, 112, 160],           // Huskar
  61: [98, 250, 116, 160, 139, 225, 156, 1097],           // Broodmother
  63: [166, 1466, 168, 116, 141, 156, 160, 135, 123, 225], // Weaver
  67: [137, 98, 250, 147, 108, 160, 208, 114, 225, 127],  // Spectre
  70: [145, 1, 116, 208, 156, 225, 135, 108, 603, 174],   // Ursa
  72: [596, 147, 116, 108, 141, 156, 139, 135, 160, 225], // Gyrocopter
  73: [137, 1, 116, 112, 208, 249, 225, 135, 158],        // Alchemist
  74: [65, 166, 1466, 263, 116, 108, 96, 110, 235, 119, 250], // Invoker
  76: [534, 263, 116, 96, 108, 597, 1, 249, 123],         // Outworld Destroyer
  81: [151, 939, 147, 116, 114, 112, 208, 249, 225],      // Chaos Knight
  82: [174, 1097, 1, 108, 160, 96, 139, 603],             // Meepo
  89: [147, 1097, 98, 250, 114, 160, 139, 208],           // Naga Siren
  93: [174, 1097, 939, 152, 249, 108, 116, 208, 160, 225, 156, 135], // Slark
  94: [147, 139, 160, 141, 1097, 135, 263, 603, 96],      // Medusa
  95: [145, 158, 154, 116, 156, 208, 225, 135, 139, 1],   // Troll Warlord
  98: [259, 692, 119, 108, 226, 121, 116, 610],           // Timbersaw
  99: [108, 121, 692, 154, 116, 226, 119, 208, 112],      // Bristleback
  104: [127, 1, 116, 108, 225, 141, 112, 249, 939],       // Legion Commander
  106: [598, 166, 1466, 119, 116, 108, 259, 141, 123],    // Ember Spirit
  109: [147, 160, 139, 116, 141, 156, 263, 135, 603],     // Terrorblade
  113: [65, 166, 1466, 158, 147, 250, 96, 135, 249, 263], // Arc Warden
  114: [158, 939, 116, 160, 208, 156, 225, 135, 139],     // Monkey King
  126: [252, 147, 108, 116, 141, 96, 259, 119],           // Void Spirit
  129: [1, 116, 168, 90, 119, 156, 110, 226],             // Mars
  138: [166, 158, 263, 116, 141, 156, 135, 249, 96],      // Muerta
  145: [145, 168, 116, 141, 156, 208, 225, 135, 603, 147] // Kez
};


/**
 * Полный справочник предметов Dota 2 (включая базовые компоненты #1..#250 и все новые предметы патчей 7.33–7.41+:
 * Harpoon #939, Disperser #1097, Khanda #1107, Phylactery #1100, Parasma #597/#1164, Gleipnir #1466,
 * Mage Slayer #598, Eternal Shroud #692, Soul Ring #178, Ogre Axe #21, Quelling Blade #11 и др.)
 */
const ITEMS_DB = {
  1: { name: 'Blink Dagger', slug: 'blink', cost: 2250, major: true },
  2: { name: 'Blades of Attack', slug: 'blades_of_attack', cost: 450 },
  3: { name: 'Broadsword', slug: 'broadsword', cost: 1000 },
  4: { name: 'Chainmail', slug: 'chainmail', cost: 550 },
  5: { name: 'Claymore', slug: 'claymore', cost: 1350 },
  6: { name: 'Helm of Iron Will', slug: 'helm_of_iron_will', cost: 975 },
  7: { name: 'Javelin', slug: 'javelin', cost: 1100 },
  8: { name: 'Mithril Hammer', slug: 'mithril_hammer', cost: 1600 },
  9: { name: 'Platemail', slug: 'platemail', cost: 1400 },
  10: { name: 'Quarterstaff', slug: 'quarterstaff', cost: 875 },
  11: { name: 'Quelling Blade', slug: 'quelling_blade', cost: 100 },
  12: { name: 'Ring of Protection', slug: 'ring_of_protection', cost: 175 },
  13: { name: 'Gauntlets of Strength', slug: 'gauntlets', cost: 140 },
  14: { name: 'Slippers of Agility', slug: 'slippers', cost: 140 },
  15: { name: 'Mantle of Intelligence', slug: 'mantle', cost: 140 },
  16: { name: 'Iron Branch', slug: 'branches', cost: 50 },
  17: { name: 'Belt of Strength', slug: 'belt_of_strength', cost: 450 },
  18: { name: 'Band of Elvenskin', slug: 'boots_of_elves', cost: 450 },
  19: { name: 'Robe of the Magi', slug: 'robe', cost: 450 },
  20: { name: 'Circlet', slug: 'circlet', cost: 155 },
  21: { name: 'Ogre Axe', slug: 'ogre_axe', cost: 1000 },
  22: { name: 'Blade of Alacrity', slug: 'blade_of_alacrity', cost: 1000 },
  23: { name: 'Staff of Wizardry', slug: 'staff_of_wizardry', cost: 1000 },
  24: { name: 'Ultimate Orb', slug: 'ultimate_orb', cost: 2800, major: true },
  25: { name: 'Gloves of Haste', slug: 'gloves', cost: 450 },
  26: { name: 'Morbid Mask', slug: 'lifesteal', cost: 900 },
  27: { name: 'Ring of Regen', slug: 'ring_of_regen', cost: 175 },
  28: { name: "Sage's Mask", slug: 'sobi_mask', cost: 175 },
  29: { name: 'Boots of Speed', slug: 'boots', cost: 500, boots: true },
  30: { name: 'Gem of True Sight', slug: 'gem', cost: 900 },
  31: { name: 'Cloak', slug: 'cloak', cost: 800 },
  32: { name: 'Talisman of Evasion', slug: 'talisman_of_evasion', cost: 1300 },
  33: { name: 'Cheese', slug: 'cheese', cost: 1000 },
  34: { name: 'Magic Stick', slug: 'magic_stick', cost: 200 },
  36: { name: 'Magic Wand', slug: 'magic_wand', cost: 450 },
  37: { name: 'Ghost Scepter', slug: 'ghost', cost: 1500 },
  38: { name: 'Clarity', slug: 'clarity', cost: 50 },
  39: { name: 'Healing Salve', slug: 'flask', cost: 100 },
  40: { name: 'Dust of Appearance', slug: 'dust', cost: 80 },
  41: { name: 'Bottle', slug: 'bottle', cost: 675 },
  42: { name: 'Observer Ward', slug: 'ward_observer', cost: 0 },
  43: { name: 'Sentry Ward', slug: 'ward_sentry', cost: 50 },
  44: { name: 'Tango', slug: 'tango', cost: 90 },
  46: { name: 'Town Portal Scroll', slug: 'tpscroll', cost: 100 },
  48: { name: 'Boots of Travel', slug: 'travel_boots', cost: 2500, boots: true, major: true },
  50: { name: 'Phase Boots', slug: 'phase_boots', cost: 1500, boots: true },
  51: { name: 'Demon Edge', slug: 'demon_edge', cost: 2200 },
  52: { name: 'Eaglesong', slug: 'eagle', cost: 2800 },
  53: { name: 'Reaver', slug: 'reaver', cost: 2800 },
  54: { name: 'Sacred Relic', slug: 'relic', cost: 3400 },
  55: { name: 'Hyperstone', slug: 'hyperstone', cost: 2000 },
  56: { name: 'Ring of Health', slug: 'ring_of_health', cost: 700 },
  57: { name: 'Void Stone', slug: 'void_stone', cost: 700 },
  58: { name: 'Mystic Staff', slug: 'mystic_staff', cost: 2800 },
  59: { name: 'Energy Booster', slug: 'energy_booster', cost: 800 },
  60: { name: 'Point Booster', slug: 'point_booster', cost: 1200 },
  61: { name: 'Vitality Booster', slug: 'vitality_booster', cost: 1000 },
  63: { name: 'Power Treads', slug: 'power_treads', cost: 1400, boots: true },
  65: { name: 'Hand of Midas', slug: 'hand_of_midas', cost: 2200, major: true },
  67: { name: 'Oblivion Staff', slug: 'oblivion_staff', cost: 1500 },
  69: { name: 'Perseverance', slug: 'pers', cost: 1400 },
  73: { name: 'Bracer', slug: 'bracer', cost: 505 },
  75: { name: 'Wraith Band', slug: 'wraith_band', cost: 505 },
  77: { name: 'Null Talisman', slug: 'null_talisman', cost: 505 },
  79: { name: 'Mekansm', slug: 'mekansm', cost: 1775, major: true },
  81: { name: "Vladmir's Offering", slug: 'vladmir', cost: 2200, major: true },
  86: { name: 'Buckler', slug: 'buckler', cost: 425 },
  88: { name: 'Ring of Basilius', slug: 'ring_of_basilius', cost: 425 },
  90: { name: 'Pipe of Insight', slug: 'pipe', cost: 3725, major: true },
  92: { name: 'Urn of Shadows', slug: 'urn_of_shadows', cost: 880 },
  94: { name: 'Headdress', slug: 'headdress', cost: 425 },
  96: { name: 'Scythe of Vyse', slug: 'sheepstick', cost: 5675, major: true },
  98: { name: 'Orchid Malevolence', slug: 'orchid', cost: 3475, major: true },
  100: { name: "Eul's Scepter", slug: 'cyclone', cost: 2625, major: true },
  102: { name: 'Force Staff', slug: 'force_staff', cost: 2200, major: true },
  104: { name: 'Dagon', slug: 'dagon', cost: 2850, major: true },
  106: { name: 'Necronomicon', slug: 'necronomicon', cost: 2050, major: true },
  108: { name: "Aghanim's Scepter", slug: 'ultimate_scepter', cost: 4200, major: true },
  110: { name: 'Refresher Orb', slug: 'refresher', cost: 5000, major: true },
  112: { name: 'Assault Cuirass', slug: 'assault', cost: 5125, major: true },
  114: { name: 'Heart of Tarrasque', slug: 'heart', cost: 5200, major: true },
  116: { name: 'Black King Bar', slug: 'black_king_bar', cost: 4050, major: true },
  117: { name: 'Aegis of the Immortal', slug: 'aegis', cost: 0 },
  119: { name: "Shiva's Guard", slug: 'shivas_guard', cost: 5175, major: true },
  121: { name: 'Bloodstone', slug: 'bloodstone', cost: 4400, major: true },
  123: { name: "Linken's Sphere", slug: 'sphere', cost: 4800, major: true },
  125: { name: 'Vanguard', slug: 'vanguard', cost: 1700 },
  127: { name: 'Blade Mail', slug: 'blade_mail', cost: 2100, major: true },
  129: { name: 'Soul Booster', slug: 'soul_booster', cost: 3000, major: true },
  131: { name: 'Hood of Defiance', slug: 'hood_of_defiance', cost: 1500 },
  133: { name: 'Divine Rapier', slug: 'rapier', cost: 5600, major: true },
  135: { name: 'Monkey King Bar', slug: 'monkey_king_bar', cost: 4700, major: true },
  137: { name: 'Radiance', slug: 'radiance', cost: 4700, major: true },
  139: { name: 'Butterfly', slug: 'butterfly', cost: 5450, major: true },
  141: { name: 'Daedalus', slug: 'greater_crit', cost: 5100, major: true },
  143: { name: 'Skull Basher', slug: 'basher', cost: 2875, major: true },
  145: { name: 'Battle Fury', slug: 'bfury', cost: 4100, major: true },
  147: { name: 'Manta Style', slug: 'manta', cost: 4550, major: true },
  149: { name: 'Crystalys', slug: 'lesser_crit', cost: 2000 },
  151: { name: 'Armlet of Mordiggian', slug: 'armlet', cost: 2500, major: true },
  152: { name: 'Shadow Blade', slug: 'invis_sword', cost: 3000, major: true },
  154: { name: 'Sange and Yasha', slug: 'sange_and_yasha', cost: 4100, major: true },
  156: { name: 'Satanic', slug: 'satanic', cost: 5050, major: true },
  158: { name: 'Mjollnir', slug: 'mjollnir', cost: 5500, major: true },
  160: { name: 'Eye of Skadi', slug: 'skadi', cost: 5300, major: true },
  162: { name: 'Sange', slug: 'sange', cost: 2000 },
  164: { name: 'Helm of the Dominator', slug: 'helm_of_the_dominator', cost: 2625, major: true },
  166: { name: 'Maelstrom', slug: 'maelstrom', cost: 2950, major: true },
  168: { name: 'Desolator', slug: 'desolator', cost: 3500, major: true },
  170: { name: 'Yasha', slug: 'yasha', cost: 2000 },
  172: { name: 'Mask of Madness', slug: 'mask_of_madness', cost: 1900 },
  174: { name: 'Diffusal Blade', slug: 'diffusal_blade', cost: 2500, major: true },
  176: { name: 'Ethereal Blade', slug: 'ethereal_blade', cost: 5375, major: true },
  178: { name: 'Soul Ring', slug: 'soul_ring', cost: 805 },
  180: { name: 'Arcane Boots', slug: 'arcane_boots', cost: 1300, boots: true },
  181: { name: 'Orb of Venom', slug: 'orb_of_venom', cost: 250 },
  185: { name: 'Drum of Endurance', slug: 'ancient_janggo', cost: 1650 },
  187: { name: 'Medallion of Courage', slug: 'medallion_of_courage', cost: 1025 },
  188: { name: 'Smoke of Deceit', slug: 'smoke_of_deceit', cost: 50 },
  190: { name: 'Veil of Discord', slug: 'veil_of_discord', cost: 1725 },
  201: { name: 'Dagon 2', slug: 'dagon_2', cost: 4000, major: true },
  202: { name: 'Dagon 3', slug: 'dagon_3', cost: 5150, major: true },
  203: { name: 'Dagon 4', slug: 'dagon_4', cost: 6300, major: true },
  204: { name: 'Dagon 5', slug: 'dagon_5', cost: 7450, major: true },
  206: { name: 'Rod of Atos', slug: 'rod_of_atos', cost: 2250, major: true },
  208: { name: 'Abyssal Blade', slug: 'abyssal_blade', cost: 6250, major: true },
  210: { name: "Heaven's Halberd", slug: 'heavens_halberd', cost: 3550, major: true },
  214: { name: 'Tranquil Boots', slug: 'tranquil_boots', cost: 925, boots: true },
  215: { name: 'Shadow Amulet', slug: 'shadow_amulet', cost: 1000 },
  216: { name: 'Enchanted Mango', slug: 'enchanted_mango', cost: 65 },
  218: { name: 'Observer and Sentry Wards', slug: 'ward_dispenser', cost: 50 },
  220: { name: 'Boots of Travel 2', slug: 'travel_boots_2', cost: 4500, boots: true, major: true },
  223: { name: 'Meteor Hammer', slug: 'meteor_hammer', cost: 2850, major: true },
  225: { name: 'Nullifier', slug: 'nullifier', cost: 4375, major: true },
  226: { name: 'Lotus Orb', slug: 'lotus_orb', cost: 3850, major: true },
  229: { name: 'Solar Crest', slug: 'solar_crest', cost: 2700, major: true },
  231: { name: 'Guardian Greaves', slug: 'guardian_greaves', cost: 4950, boots: true, major: true },
  232: { name: 'Aether Lens', slug: 'aether_lens', cost: 2275, major: true },
  235: { name: 'Octarine Core', slug: 'octarine_core', cost: 4600, major: true },
  236: { name: 'Dragon Lance', slug: 'dragon_lance', cost: 1900 },
  237: { name: 'Faerie Fire', slug: 'faerie_fire', cost: 65 },
  240: { name: 'Blight Stone', slug: 'blight_stone', cost: 300 },
  242: { name: 'Crimson Guard', slug: 'crimson_guard', cost: 3725, major: true },
  244: { name: 'Wind Lace', slug: 'wind_lace', cost: 250 },
  247: { name: 'Moon Shard', slug: 'moon_shard', cost: 4000, major: true },
  249: { name: 'Silver Edge', slug: 'silver_edge', cost: 5450, major: true },
  250: { name: 'Bloodthorn', slug: 'bloodthorn', cost: 6825, major: true },
  252: { name: 'Echo Sabre', slug: 'echo_sabre', cost: 2700, major: true },
  254: { name: 'Glimmer Cape', slug: 'glimmer_cape', cost: 2150, major: true },
  256: { name: 'Aeon Disk', slug: 'aeon_disk', cost: 3000, major: true },
  259: { name: 'Kaya and Sange', slug: 'kaya_and_sange', cost: 4100, major: true },
  263: { name: 'Hurricane Pike', slug: 'hurricane_pike', cost: 4450, major: true },
  265: { name: 'Infused Raindrops', slug: 'infused_raindrop', cost: 225 },
  267: { name: 'Spirit Vessel', slug: 'spirit_vessel', cost: 2780, major: true },
  269: { name: 'Holy Locket', slug: 'holy_locket', cost: 2250, major: true },
  273: { name: 'Kaya', slug: 'kaya', cost: 2050 },
  277: { name: 'Yasha and Kaya', slug: 'yasha_and_kaya', cost: 4100, major: true },
  534: { name: 'Witch Blade', slug: 'witch_blade', cost: 2775, major: true },
  569: { name: 'Orb of Corrosion', slug: 'orb_of_corrosion', cost: 925 },
  596: { name: 'Falcon Blade', slug: 'falcon_blade', cost: 1125 },
  597: { name: 'Parasma', slug: 'devastator', cost: 5575, major: true },
  598: { name: 'Mage Slayer', slug: 'mage_slayer', cost: 2825, major: true },
  600: { name: 'Overwhelming Blink', slug: 'overwhelming_blink', cost: 6800, major: true },
  603: { name: 'Swift Blink', slug: 'swift_blink', cost: 6800, major: true },
  604: { name: 'Arcane Blink', slug: 'arcane_blink', cost: 6800, major: true },
  610: { name: 'Wind Waker', slug: 'wind_waker', cost: 6825, major: true },
  635: { name: 'Helm of the Overlord', slug: 'helm_of_the_overlord', cost: 5725, major: true },
  692: { name: 'Eternal Shroud', slug: 'eternal_shroud', cost: 3600, major: true },
  911: { name: "Revenant's Brooch", slug: 'revenants_brooch', cost: 4900, major: true },
  931: { name: 'Boots of Bearing', slug: 'boots_of_bearing', cost: 4275, boots: true, major: true },
  939: { name: 'Harpoon', slug: 'harpoon', cost: 4700, major: true },
  1097: { name: 'Disperser', slug: 'disperser', cost: 6100, major: true },
  1100: { name: 'Phylactery', slug: 'phylactery', cost: 2600, major: true },
  1107: { name: 'Khanda', slug: 'angels_demise', cost: 5200, major: true },
  1123: { name: 'Blood Grenade', slug: 'blood_grenade', cost: 50 },
  1124: { name: 'Cornucopia', slug: 'cornucopia', cost: 1200 },
  1128: { name: 'Pavise', slug: 'pavise', cost: 1400 },
  1164: { name: 'Parasma', slug: 'devastator', cost: 5575, major: true },
  1466: { name: 'Gleipnir', slug: 'gungir', cost: 5650, major: true },
  1806: { name: 'Parasma', slug: 'devastator', cost: 5575, major: true }
};

/**
 * Позволяет динамически обогатить базу ITEMS_DB свежим ответом /api/constants/items из OpenDota API
 */
/**
 * Динамическая регистрация героев (/api/constants/heroes) и способностей (/api/constants/abilities, /api/constants/hero_abilities)
 */
function registerOpenDotaHeroesAndAbilities(heroesMap, abilitiesMap, heroAbilitiesMap) {
  if (abilitiesMap && typeof abilitiesMap === "object") {
    for (const [abKey, abObj] of Object.entries(abilitiesMap)) {
      if (!abObj) continue;
      ABILITIES_DB[abKey] = {
        key: abKey,
        dname: abObj.dname || abKey,
        behavior: abObj.behavior || null,
        bkbpierce: abObj.bkbpierce || null,
        dispellable: abObj.dispellable || null,
        cd: Array.isArray(abObj.cd)
          ? Number(abObj.cd[abObj.cd.length - 1] || 0)
          : Number(abObj.cd || 0)
      };
    }
  }

  if (heroesMap && typeof heroesMap === "object") {
    for (const h of Object.values(heroesMap)) {
      if (!h || !h.id) continue;
      const id = Number(h.id);
      const roles = Array.isArray(h.roles) ? h.roles : [];
      const existing = HEROES_DB[id] || {};
      const internalName = String(h.name || "").replace(/^npc_dota_hero_/, "");

      let bigUlt = existing.bigUlt || null;
      let ultLabel = existing.ultLabel || null;
      let ultCd = existing.ultCd || 100;

      if (heroAbilitiesMap && heroAbilitiesMap[h.name] && Array.isArray(heroAbilitiesMap[h.name].abilities)) {
        const abList = heroAbilitiesMap[h.name].abilities.filter(a => a && !a.includes("generic_hidden"));
        const lastAbKey = abList[abList.length - 1];
        if (lastAbKey && !bigUlt) {
          bigUlt = lastAbKey;
          const abMeta = ABILITIES_DB[lastAbKey];
          ultLabel = (abMeta && abMeta.dname) || lastAbKey;
          if (abMeta && abMeta.cd >= 40) ultCd = abMeta.cd;
        }
      }

      HEROES_DB[id] = {
        ...existing,
        name: h.localized_name || existing.name || internalName || `Hero #${id}`,
        slug: internalName || existing.slug || null,
        isSupport: existing.isSupport ?? (roles.includes("Support") && !roles.includes("Carry")),
        pusher: existing.pusher ?? roles.includes("Pusher"),
        spellcaster: existing.spellcaster ?? (roles.includes("Nuker") && !roles.includes("Carry") && h.attack_type === "Ranged"),
        bigUlt,
        ultLabel,
        ultCd
      };
    }
  }
}

/**
 * Парсинг и кэширование популярных предметов на герое из /api/heroes/{hero_id}/itemPopularity
 */
function registerHeroItemPopularity(heroId, popData) {
  if (!heroId || !popData || typeof popData !== "object") return null;
  const id = Number(heroId);
  const earlyItems = popData.early_game_items || {};
  const midItems = popData.mid_game_items || {};
  const lateItems = popData.late_game_items || {};

  const combinedScores = {};
  for (const [itemIdStr, count] of Object.entries(earlyItems)) {
    combinedScores[itemIdStr] = (combinedScores[itemIdStr] || 0) + Number(count || 0) * 0.35;
  }
  for (const [itemIdStr, count] of Object.entries(midItems)) {
    combinedScores[itemIdStr] = (combinedScores[itemIdStr] || 0) + Number(count || 0) * 1.0;
  }
  for (const [itemIdStr, count] of Object.entries(lateItems)) {
    combinedScores[itemIdStr] = (combinedScores[itemIdStr] || 0) + Number(count || 0) * 1.1;
  }

  const sortedIds = Object.entries(combinedScores)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => Number(k))
    .filter(itemId => itemId > 0 && (!ITEMS_DB[itemId] || (ITEMS_DB[itemId].cost || 0) >= 1400));

  const topMetaItemIds = sortedIds.slice(0, 12);
  const maxMidCount = Math.max(1, ...Object.values(midItems).map(v => Number(v || 0)));
  const maxLateCount = Math.max(1, ...Object.values(lateItems).map(v => Number(v || 0)));
  const bkbMidCount = Number(midItems["116"] || midItems[116] || 0);
  const bkbLateCount = Number(lateItems["116"] || lateItems[116] || 0);

  const bkbRankIndex = topMetaItemIds.indexOf(116);
  const bkbRatio = Math.max(bkbMidCount / maxMidCount, bkbLateCount / maxLateCount);
  const bkbIsPopular =
    !INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS.has(id) &&
    ((bkbRankIndex >= 0 && bkbRankIndex <= 7) || bkbRatio >= 0.25);

  const profile = {
    heroId: id,
    topMetaItemIds,
    topMetaItemNames: topMetaItemIds.slice(0, 8).map(iId => (ITEMS_DB[iId] && ITEMS_DB[iId].name) || `Item #${iId}`),
    bkbIsPopular,
    bkbRatio: Number(bkbRatio.toFixed(2)),
    raw: popData
  };
  HERO_ITEM_POPULARITY_CACHE[id] = profile;
  return profile;
}

function getHeroMetaProfile(heroId) {
  const id = Number(heroId);
  if (HERO_ITEM_POPULARITY_CACHE[id]) {
    return HERO_ITEM_POPULARITY_CACHE[id];
  }
  const isInnateOrElusive = INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS.has(id);
  const heroMeta = HEROES_DB[id] || {};
  let defaultMetaIds = HERO_CURATED_META_ITEMS[id];
  if (!defaultMetaIds) {
    if (heroMeta.isSupport) {
      defaultMetaIds = [254, 102, 232, 108, 229, 1, 100, 226, 37, 231, 931, 1128];
    } else if (heroMeta.spellcaster) {
      defaultMetaIds = [1, 116, 108, 119, 96, 259, 692, 235, 90, 226, 610];
    } else if (isInnateOrElusive) {
      defaultMetaIds = [147, 156, 1097, 154, 108, 160, 208, 139, 225, 135];
    } else {
      defaultMetaIds = [116, 1, 147, 168, 141, 156, 108, 939, 225, 135, 160];
    }
  }
  return {
    heroId: id,
    topMetaItemIds: defaultMetaIds,
    topMetaItemNames: defaultMetaIds.slice(0, 10).map(iId => (ITEMS_DB[iId] && ITEMS_DB[iId].name) || `Item #${iId}`),
    bkbIsPopular: !isInnateOrElusive && BKB_DEPENDENT_STRIKER_HERO_IDS.has(id),
    bkbRatio: isInnateOrElusive ? 0.08 : 0.45,
    metaSource: HERO_CURATED_META_ITEMS[id] ? "STRATZ / 7.41 Meta DB" : "Role Baseline Meta",
    isFallback: true
  };
}

function isBkbPopularForHero(heroId) {
  return Boolean(getHeroMetaProfile(heroId).bkbIsPopular);
}

/**
 * Вызов STRATZ GraphQL API (https://api.stratz.com/graphql) с JWT-токеном
 */
async function fetchStratzGraphQL(query, variables = {}, options = {}) {
  const token = options.stratzToken || DEFAULT_STRATZ_API_TOKEN;
  if (!token) return null;
  const timeoutMs = options.timeoutMs || 4000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch("https://api.stratz.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "User-Agent": "STRATZ_API"
      },
      signal: ctrl.signal,
      body: JSON.stringify({ query, variables })
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json && json.data ? json.data : null;
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Обогащение матча через STRATZ GraphQL API:
 * Если матч не распарсен в OpenDota (нет purchase_log, lane_role, radiant_gold_adv),
 * подтягивает точные тайминги покупок (stats.itemPurchases), роли (POSITION_1..POSITION_5) и золото из STRATZ!
 * А если OpenDota недоступен, конвертирует ответ STRATZ в формат OpenDota.
 */
async function fetchStratzMatchAndEnrich(matchId, openDotaMatch = null, options = {}) {
  const cleanId = Number(String(matchId || "").replace(/\D/g, ""));
  if (!cleanId) return openDotaMatch;

  const query = `
    query GetMatchForRuinDetector($matchId: Long!) {
      match(id: $matchId) {
        id
        didRadiantWin
        durationSeconds
        radiantKills
        direKills
        radiantNetworthLeads
        players {
          playerSlot
          steamAccountId
          steamAccount {
            name
          }
          heroId
          position
          lane
          role
          isVictory
          kills
          deaths
          assists
          numLastHits
          numDenies
          goldPerMinute
          experiencePerMinute
          networth
          heroDamage
          towerDamage
          heroHealing
          item0Id
          item1Id
          item2Id
          item3Id
          item4Id
          item5Id
          backpack0Id
          backpack1Id
          backpack2Id
          neutral0Id
          stats {
            itemPurchases {
              itemId
              time
            }
          }
        }
      }
    }
  `;

  const data = await fetchStratzGraphQL(query, { matchId: cleanId }, options);
  const sMatch = data && data.match ? data.match : null;
  if (!sMatch || !Array.isArray(sMatch.players) || sMatch.players.length === 0) {
    return openDotaMatch;
  }

  const parseStratzPosition = (posStr) => {
    if (!posStr) return null;
    const m = String(posStr).match(/POSITION_([1-5])/);
    return m ? Number(m[1]) : null;
  };

  const buildPurchaseLogFromStratz = (itemPurchases) => {
    if (!Array.isArray(itemPurchases) || itemPurchases.length === 0) return [];
    return itemPurchases
      .filter(e => e && e.itemId && ITEMS_DB[e.itemId] && ITEMS_DB[e.itemId].slug)
      .map(e => ({
        time: Number(e.time || 0),
        key: ITEMS_DB[e.itemId].slug,
        itemId: Number(e.itemId)
      }))
      .sort((a, b) => a.time - b.time);
  };

  if (!openDotaMatch) {
    const radiantScore = Array.isArray(sMatch.radiantKills)
      ? sMatch.radiantKills.reduce((a, b) => a + b, 0)
      : sMatch.players.filter(p => p.playerSlot < 128).reduce((s, p) => s + (p.kills || 0), 0);
    const direScore = Array.isArray(sMatch.direKills)
      ? sMatch.direKills.reduce((a, b) => a + b, 0)
      : sMatch.players.filter(p => p.playerSlot >= 128).reduce((s, p) => s + (p.kills || 0), 0);

    return {
      match_id: sMatch.id || cleanId,
      duration: sMatch.durationSeconds || 2400,
      radiant_win: Boolean(sMatch.didRadiantWin),
      radiant_score: radiantScore,
      dire_score: direScore,
      radiant_gold_adv: Array.isArray(sMatch.radiantNetworthLeads) ? sMatch.radiantNetworthLeads : [],
      stratz_enriched: true,
      players: sMatch.players.map((sp, idx) => {
        const slot = typeof sp.playerSlot === "number" ? sp.playerSlot : (idx < 5 ? idx : 128 + (idx - 5));
        const posNum = parseStratzPosition(sp.position);
        return {
          player_slot: slot,
          account_id: sp.steamAccountId || null,
          personaname: (sp.steamAccount && sp.steamAccount.name) || `Player #${idx + 1}`,
          hero_id: Number(sp.heroId),
          stratz_position: posNum,
          kills: sp.kills || 0,
          deaths: sp.deaths || 0,
          assists: sp.assists || 0,
          last_hits: sp.numLastHits || 0,
          denies: sp.numDenies || 0,
          gold_per_min: sp.goldPerMinute || 0,
          xp_per_min: sp.experiencePerMinute || 0,
          net_worth: sp.networth || 0,
          total_gold: Math.max(sp.networth || 0, Math.round((sp.goldPerMinute || 300) * ((sMatch.durationSeconds || 2400) / 60))),
          hero_damage: sp.heroDamage || 0,
          tower_damage: sp.towerDamage || 0,
          hero_healing: sp.heroHealing || 0,
          item_0: sp.item0Id || 0,
          item_1: sp.item1Id || 0,
          item_2: sp.item2Id || 0,
          item_3: sp.item3Id || 0,
          item_4: sp.item4Id || 0,
          item_5: sp.item5Id || 0,
          backpack_0: sp.backpack0Id || 0,
          backpack_1: sp.backpack1Id || 0,
          backpack_2: sp.backpack2Id || 0,
          item_neutral: sp.neutral0Id || 0,
          purchase_log: buildPurchaseLogFromStratz(sp.stats && sp.stats.itemPurchases)
        };
      })
    };
  }

  // Обогащаем существующий матч из OpenDota данными STRATZ
  if ((!Array.isArray(openDotaMatch.radiant_gold_adv) || openDotaMatch.radiant_gold_adv.length === 0) && Array.isArray(sMatch.radiantNetworthLeads) && sMatch.radiantNetworthLeads.length > 0) {
    openDotaMatch.radiant_gold_adv = sMatch.radiantNetworthLeads;
  }
  openDotaMatch.stratz_enriched = true;

  if (Array.isArray(openDotaMatch.players)) {
    for (const odPlayer of openDotaMatch.players) {
      const sp = sMatch.players.find(
        x => Number(x.heroId) === Number(odPlayer.hero_id) || Number(x.playerSlot) === Number(odPlayer.player_slot)
      );
      if (!sp) continue;
      const posNum = parseStratzPosition(sp.position);
      if (posNum) odPlayer.stratz_position = posNum;
      if (!odPlayer.backpack_0 && sp.backpack0Id) odPlayer.backpack_0 = sp.backpack0Id;
      if (!odPlayer.backpack_1 && sp.backpack1Id) odPlayer.backpack_1 = sp.backpack1Id;
      if (!odPlayer.backpack_2 && sp.backpack2Id) odPlayer.backpack_2 = sp.backpack2Id;
      if (!odPlayer.item_neutral && sp.neutral0Id) odPlayer.item_neutral = sp.neutral0Id;

      if ((!Array.isArray(odPlayer.purchase_log) || odPlayer.purchase_log.length === 0) && sp.stats && Array.isArray(sp.stats.itemPurchases)) {
        const pLog = buildPurchaseLogFromStratz(sp.stats.itemPurchases);
        if (pLog.length > 0) {
          odPlayer.purchase_log = pLog;
        }
      }
    }
  }

  return openDotaMatch;
}

/**
 * syncDotaConstantsAndMeta() — тянет актуальные данные из OpenDota API и STRATZ GraphQL API:
 * /api/constants/heroes, /api/constants/abilities, /api/constants/items, /api/heroes/{hero_id}/itemPopularity + STRATZ heroStats
 */
let dotaConstantsSynced = false;
async function syncDotaConstantsAndMeta(heroIdsOrPlayers = [], options = {}) {
  const baseUrl = options.openDotaBaseUrl || "https://api.opendota.com/api";
  const timeoutMs = options.timeoutMs || 3500;

  const fetchJsonWithTimeout = async (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      return resp.ok ? await resp.json() : null;
    } catch (_) {
      clearTimeout(timer);
      return null;
    }
  };

  if (!dotaConstantsSynced) {
    try {
      const [heroesData, itemsData, abilitiesData, heroAbilitiesData] = await Promise.all([
        fetchJsonWithTimeout(`${baseUrl}/constants/heroes`),
        fetchJsonWithTimeout(`${baseUrl}/constants/items`),
        fetchJsonWithTimeout(`${baseUrl}/constants/abilities`),
        fetchJsonWithTimeout(`${baseUrl}/constants/hero_abilities`)
      ]);

      if (itemsData) registerOpenDotaItemsConstants(itemsData);
      if (heroesData || abilitiesData) {
        registerOpenDotaHeroesAndAbilities(heroesData, abilitiesData, heroAbilitiesData);
      }
      if (heroesData && itemsData) dotaConstantsSynced = true;
    } catch (_) {}
  }

  const uniqueHeroIds = [...new Set(
    (Array.isArray(heroIdsOrPlayers) ? heroIdsOrPlayers : [])
      .map(x => (typeof x === "object" && x !== null ? Number(x.hero_id) : Number(x)))
      .filter(id => id > 0 && !HERO_ITEM_POPULARITY_CACHE[id])
  )];

  if (uniqueHeroIds.length > 0) {
    await Promise.allSettled(
      uniqueHeroIds.map(async (hId) => {
        const popData = await fetchJsonWithTimeout(`${baseUrl}/heroes/${hId}/itemPopularity`);
        if (popData) {
          const prof = registerHeroItemPopularity(hId, popData);
          if (prof && HERO_CURATED_META_ITEMS[hId]) {
            const merged = [...new Set([...prof.topMetaItemIds, ...HERO_CURATED_META_ITEMS[hId]])];
            prof.topMetaItemIds = merged.slice(0, 16);
            prof.topMetaItemNames = prof.topMetaItemIds.slice(0, 10).map(iId => (ITEMS_DB[iId] && ITEMS_DB[iId].name) || `Item #${iId}`);
            prof.metaSource = "OpenDota Live + STRATZ Meta";
          }
        }
      })
    );
  }

  return {
    constantsSynced: dotaConstantsSynced,
    cachedHeroPopularityCount: Object.keys(HERO_ITEM_POPULARITY_CACHE).length
  };
}

/**
 * Формирование компактного JSON для LLM-аудита сборки (buildLlmAuditPayload)
 * и реальный вызов API модели (requestLlmBuildVerdict)
 */
function buildLlmAuditPayload(player, roleInfo, invAudit, enemyPlayers, metaProfile, durationMin, netWorth, wonMatch, targetThreatReport = null) {
  const isInnateOrElusive = INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS.has(player.hero_id);
  const playerItemIds = invAudit.richItems.map(i => i.id);
  const matchedMetaItems = invAudit.richItems
    .filter(i => metaProfile.topMetaItemIds.includes(i.id) || META_DISPEL_OR_SAVE_ITEM_IDS.has(i.id))
    .map(i => i.name);

  return {
    hero: {
      id: player.hero_id,
      name: roleInfo.heroName,
      role: roleInfo.roleLabel,
      position: roleInfo.position,
      has_innate_immunity_or_elusive: isInnateOrElusive
    },
    match_context: {
      duration_min: Math.round(durationMin),
      won_match: Boolean(wonMatch)
    },
    player_stats: {
      kills: player.kills || 0,
      deaths: player.deaths || 0,
      assists: player.assists || 0,
      net_worth: netWorth,
      gpm: player.gold_per_min || 0,
      hero_damage: player.hero_damage || 0,
      tower_damage: player.tower_damage || 0
    },
    player_items: invAudit.richItems.map(i => ({
      id: i.id,
      name: i.name,
      cost: i.cost,
      bought_at: i.boughtAt || null
    })),
    enemy_draft: (enemyPlayers || []).map(ep => ({
      hero_id: ep.hero_id,
      hero_name: (HEROES_DB[ep.hero_id] && HEROES_DB[ep.hero_id].name) || ep.hero_name || `Hero #${ep.hero_id}`,
      items: [ep.item_0, ep.item_1, ep.item_2, ep.item_3, ep.item_4, ep.item_5]
        .filter(id => id && id > 0)
        .map(id => (ITEMS_DB[id] && ITEMS_DB[id].name) || `Item #${id}`)
    })),
    target_threat_resolution: targetThreatReport ? {
      unresolved_evasion_weight: targetThreatReport.totalUnresolvedEvasionWeight,
      mkb_strictly_required: targetThreatReport.mkbStrictlyRequired,
      resolved_evasion_notes: targetThreatReport.resolvedNotes,
      unresolved_evasion_sources: targetThreatReport.unresolvedLabels
    } : null,
    meta_popularity: {
      bkb_is_popular_on_hero: metaProfile.bkbIsPopular,
      bkb_popularity_ratio: metaProfile.bkbRatio,
      popular_hero_items: metaProfile.topMetaItemNames,
      matched_meta_or_dispel_items: matchedMetaItems,
      has_meta_dispel_or_save: playerItemIds.some(id => META_DISPEL_OR_SAVE_ITEM_IDS.has(id))
    }
  };
}

async function requestLlmBuildVerdict(llmPayload, options = {}) {
  const apiKey =
    options.apiKey ||
    (typeof process !== "undefined" && process.env && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY)) ||
    null;
  if (!apiKey) return null;

  const systemPrompt = [
    "Ты — профессиональный аналитик Dota 2 (7.41+, уровень 9000+ MMR). Оцени сборку предметов игрока на основе JSON со статистикой, инвентарем, пиком врага и анализом дерева угроз (target_threat_resolution).",
    "ЖЕСТКИЕ ПРАВИЛА КОНТЕКСТНОГО АНАЛИЗА ДОТЫ:",
    "1. Встроенный иммунитет и сейв: Герои с Rage/Blade Fury/Dark Pact/Doppelganger/Time Lapse/Phase Shift/Sleight of Fist/Borrowed Time НЕ обязаны покупать BKB, если у них собраны слоты на диспел/сейв по мете (Manta, Satanic, Disperser, Lotus, S&Y, Aghanim). Никогда не штрафуй их за отсутствие BKB!",
    "2. Ценность слота (Slot Efficiency) и Перекрытие угроз: Никогда не требуй покупки MKB только из-за того, что у врага есть одиночный Radiance (например на Necrophos, WK, Alchemist). Radiance дает всего 25% уворотов самому носителю. Если против Necrophos с Radiance у керри (например Juggernaut) уже куплен Nullifier — главная угроза (Ghost Shroud) полностью снята, и Некр умирает за Nullifier + Omnislash без всякого MKB. Тратить 4700 золота и слот на MKB ради одного Радика — это ошибка экономики!",
    "3. Ослепления vs Уклонение: Ослепления от Tinker (Laser), KotL (Blinding Light), Troll (Axes) или тучка Riki контрятся диспелом (Manta, BKB, Blade Fury, Satanic, Lotus) или выходом из зоны (Force Staff), а НЕ покупкой MKB. Требуй MKB/Bloodthorn только против реального тяжелого уворота (Phantom Assassin, Butterfly на вражеском коре, Arc Warden, Windranger без Nullifier).",
    "4. Отличай пустой нетворс (например бесполезная Linken Sphere против AoE-контроля и сбивалок) от сильной мета-сборки.",
    'Верни строго JSON без markdown-обертки: {"verdictStatus": "good"|"warning"|"hidden_ruin"|"empty_networth", "headline": "короткий заголовок на русском", "explanation": "объяснение в 1-2 предложениях на русском", "economyPenalty": число от 0 до 25}.'
  ].join("\n");

  const isGeminiKey = String(apiKey).startsWith("AIza") || options.provider === "gemini";
  const timeoutMs = options.timeoutMs || 5000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    if (isGeminiKey) {
      const model = options.model || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(llmPayload) }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const data = await resp.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return rawText ? JSON.parse(rawText) : null;
    } else {
      const apiUrl = options.apiUrl || (typeof process !== "undefined" && process.env && process.env.LLM_API_URL) || "https://api.openai.com/v1/chat/completions";
      const model = options.model || "gpt-4o-mini";
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(llmPayload) }
          ]
        })
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const data = await resp.json();
      const rawText = data?.choices?.[0]?.message?.content;
      return rawText ? JSON.parse(rawText) : null;
    }
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

function registerOpenDotaItemsConstants(itemsMap) {
  if (!itemsMap || typeof itemsMap !== 'object') return;
  for (const [slugKey, itemObj] of Object.entries(itemsMap)) {
    if (!itemObj || !itemObj.id) continue;
    const id = Number(itemObj.id);
    if (!id) continue;
    const existing = ITEMS_DB[id] || {};
    const cost = Number(itemObj.cost || existing.cost || 0);
    const imgMatch = itemObj.img ? String(itemObj.img).match(/\/items\/([^.?/]+)\.png/) : null;
    const cleanSlug = (imgMatch && imgMatch[1]) || existing.slug || String(slugKey).replace(/^item_/, '');
    ITEMS_DB[id] = {
      name: itemObj.dname || existing.name || cleanSlug,
      slug: cleanSlug,
      img: itemObj.img ? (String(itemObj.img).startsWith("http") ? itemObj.img : `https://cdn.cloudflare.steamstatic.com${itemObj.img}`) : null,
      cost,
      boots: existing.boots || cleanSlug.includes('boots'),
      major: existing.major ?? (cost >= 2100)
    };
  }
}

const FARM_ACCELERATOR_ITEM_IDS = new Set([65, 137, 145, 158, 166, 172, 263, 598, 1466]);

const SUPPORT_UTILITY_ITEM_IDS = new Set([
  36, 37, 40, 42, 43, 79, 90, 102, 180, 188, 214, 218, 229, 231, 232, 254, 269, 931, 1128
]);

const ITEM_TIMING_BENCHMARKS = {
  bfury: { label: 'Battle Fury', expectedSec: 900, maxAcceptableSec: 1200, maxSlotCheckSec: 1800, coreOnly: true },
  radiance: { label: 'Radiance', expectedSec: 1050, maxAcceptableSec: 1380, maxSlotCheckSec: 1920, coreOnly: true },
  blink: { label: 'Blink Dagger', expectedSec: 780, maxAcceptableSec: 1140, maxSlotCheckSec: 1620, coreOnly: false },
  black_king_bar: { label: 'Black King Bar (BKB)', expectedSec: 1380, maxAcceptableSec: 1740, maxSlotCheckSec: 2100, coreOnly: true },
  pipe: { label: 'Pipe of Insight', expectedSec: 1320, maxAcceptableSec: 1740, maxSlotCheckSec: 2100, coreOnly: true },
  manta: { label: 'Manta Style', expectedSec: 1320, maxAcceptableSec: 1680, maxSlotCheckSec: 2040, coreOnly: true },
  desolator: { label: 'Desolator', expectedSec: 1050, maxAcceptableSec: 1380, maxSlotCheckSec: 1860, coreOnly: true },
  harpoon: { label: 'Harpoon', expectedSec: 1260, maxAcceptableSec: 1680, maxSlotCheckSec: 2040, coreOnly: true }
};

const CRITICAL_ACTIVE_ITEMS = [
  { key: 'black_king_bar', label: 'BKB', itemId: 116, variants: ['black_king_bar'], coreOnly: true },
  { key: 'pipe', label: 'Pipe of Insight', itemId: 90, variants: ['pipe'], coreOnly: false },
  { key: 'sheepstick', label: 'Hex', itemId: 96, variants: ['sheepstick'], coreOnly: false },
  { key: 'satanic', label: 'Satanic', itemId: 156, variants: ['satanic'], coreOnly: true },
  { key: 'crimson_guard', label: 'Crimson Guard', itemId: 242, variants: ['crimson_guard'], coreOnly: false }
];

// Герои с жестким контролем (станы, хексы, сайленсы, корни, стяжки), против которых корам критически нужен BKB
const HEAVY_DISABLE_HERO_IDS = new Set([
  2, 3, 7, 13, 14, 16, 17, 18, 19, 20, 21, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33,
  36, 37, 38, 41, 49, 51, 52, 55, 60, 64, 65, 69, 71, 74, 75, 76, 79, 81, 82, 83,
  84, 86, 87, 88, 90, 96, 97, 100, 101, 103, 104, 106, 107, 108, 110, 112, 114,
  119, 120, 121, 123, 126, 128, 129, 131, 135, 136, 137
]);

// Контроль по площади / в землю (AoE), от которого Linken's Sphere НЕ спасает (нужен именно BKB)
const AOE_OR_GROUND_CONTROL_HERO_IDS = new Set([
  2, 7, 13, 16, 19, 23, 26, 29, 32, 33, 37, 41, 52, 55, 60, 64, 74, 75, 82, 83,
  87, 88, 96, 97, 103, 107, 108, 110, 114, 119, 120, 123, 129, 131, 137
]);

// Герои с опасными направленными скиллами, против которых покупка Linken's Sphere реально оправдана
const HIGH_VALUE_LINKEN_TARGET_HERO_IDS = new Set([
  3, 4, 20, 25, 26, 27, 36, 38, 65, 69, 71, 76, 79, 104
]);

// Герои с дешевыми направленными скиллами с малым КД, которые легко сбивают Linken's Sphere (Track, Haze и др.)
const CHEAP_LINKEN_POPPER_HERO_IDS = new Set([
  28, 34, 40, 45, 62, 86, 99, 101
]);

// Кор-герои (особенно милишники и райткликеры вроде Kez, PA, Ursa, Sven, Troll, TA, SF), которым жизненно важно бить в драке под BKB
// Герои-инициаторы, для которых Blink Dagger является обязательным ранним слотом (~12-18 мин), а не поздним апгрейдом в Swift/Overwhelming Blink
const BLINK_INITIATOR_HERO_IDS = new Set([
  2, 7, 13, 16, 18, 19, 23, 26, 27, 28, 29, 33, 38, 51, 55, 65, 69, 77, 78, 83, 86, 96, 97, 100, 104, 120, 129, 137
]);

// Герои со встроенным иммунитетом к эффектам/магии (Rage, Blade Fury), сильным диспелом (Dark Pact, Time Lapse, Borrowed Time, Kraken Shell)
// или эскейпом/иллюзиями, для которых отсутствие BKB НЕ является ошибкой при сборке слотов на диспел/сейв по мете
const INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS = new Set([
  54,  // Lifestealer (Rage)
  8,   // Juggernaut (Blade Fury / Omnislash)
  93,  // Slark (Dark Pact / Shadow Dance)
  12,  // Phantom Lancer (Doppelganger)
  89,  // Naga Siren (Mirror Image / Song of the Siren)
  63,  // Weaver (Time Lapse / Shukuchi)
  13,  // Puck (Phase Shift / Illusory Orb)
  106, // Ember Spirit (Sleight of Fist / Fire Remnant)
  17,  // Storm Spirit (Ball Lightning)
  102, // Abaddon (Borrowed Time / Aphotic Shield)
  29   // Tidehunter (Kraken Shell)
]);

// Предметы диспела, выживаемости и сейва по мете, заменяющие BKB для героев из INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS
const META_DISPEL_OR_SAVE_ITEM_IDS = new Set([
  147,  // Manta Style
  1097, // Disperser
  156,  // Satanic
  226,  // Lotus Orb
  154,  // Sange and Yasha
  692,  // Eternal Shroud
  108   // Aghanim's Scepter
]);

// Кор-герои (без встроенного иммунитета/эскейпа: Kez, PA, Ursa, Sven, Troll, TA, SF, Luna, Gyro, MK, Muerta и др.),
// которым реально нужен BKB, чтобы бить в центре замеса против контроля (Lifestealer 54, Juggernaut 8, Slark 93, Weaver 63, PL 12 исключены!)
const BKB_DEPENDENT_STRIKER_HERO_IDS = new Set([
  1, 4, 6, 11, 15, 18, 19, 21, 25, 28, 41, 42, 44, 46, 48, 49, 52, 56,
  59, 60, 61, 70, 72, 73, 81, 95, 104, 109, 114, 126, 135, 136, 138, 145
]);

// Профильные керри 1-й позиции (чтобы лесник/четверка/пятерка с Мидасом никогда не перезаписал настоящего керри в Pos 1)
const PURE_POS1_CARRY_HERO_IDS = new Set([
  1, 4, 6, 8, 10, 12, 18, 41, 42, 44, 46, 48, 54, 56, 63, 67, 70, 72, 73, 81, 89, 93, 94, 95, 109, 113, 114, 138, 145
]);

// Герои, на которых недобросовестные игроки 4/5 позиции чаще всего уходят в лес с 0-й минуты (Pos 6 🌲 Лесник)
const JUNGLE_CAPABLE_HERO_IDS = new Set([
  2, 4, 18, 33, 40, 42, 53, 54, 58, 59, 61, 66, 69, 70, 73, 77, 80, 89, 104, 109
]);

// Слоты на голый урон без защиты (для выявления жадной сборки «Стеклянная пушка» до покупки BKB)
const GREEDY_DAMAGE_ITEM_KEYS = {
  desolator: 'Desolator',
  angels_demise: 'Khanda',
  khanda: 'Khanda',
  phylactery: 'Phylactery',
  greater_crit: 'Daedalus',
  lesser_crit: 'Crystalys',
  butterfly: 'Butterfly',
  monkey_king_bar: 'Monkey King Bar',
  moon_shard: 'Moon Shard',
  bloodthorn: 'Bloodthorn',
  orchid: 'Orchid Malevolence',
  radiance: 'Radiance',
  bfury: 'Battle Fury',
  rapier: 'Divine Rapier',
  nullifier: 'Nullifier',
  disperser: 'Disperser',
  invis_sword: 'Shadow Blade',
  silver_edge: 'Silver Edge'
};

const ITEM_PURCHASE_KEY_ALIASES = {
  116: ['black_king_bar'],
  123: ['sphere'],
  168: ['desolator'],
  1107: ['angels_demise', 'khanda'],
  1100: ['phylactery'],
  141: ['greater_crit', 'daedalus'],
  149: ['lesser_crit'],
  139: ['butterfly'],
  135: ['monkey_king_bar'],
  247: ['moon_shard'],
  250: ['bloodthorn'],
  98: ['orchid'],
  137: ['radiance'],
  145: ['bfury'],
  147: ['manta'],
  939: ['harpoon'],
  1097: ['disperser'],
  1466: ['gungir', 'gleipnir'],
  597: ['devastator', 'parasma'],
  1164: ['devastator', 'parasma'],
  1806: ['devastator', 'parasma'],
  1: ['blink'],
  112: ['assault'],
  114: ['heart'],
  160: ['skadi'],
  156: ['satanic'],
  208: ['abyssal_blade'],
  96: ['sheepstick'],
  90: ['pipe'],
  242: ['crimson_guard'],
  692: ['eternal_shroud'],
  108: ['ultimate_scepter'],
  152: ['invis_sword'],
  249: ['silver_edge'],
  263: ['hurricane_pike'],
  102: ['force_staff'],
  254: ['glimmer_cape'],
  232: ['aether_lens'],
  158: ['mjollnir'],
  166: ['maelstrom'],
  225: ['nullifier']
};

function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function isMatchReplayParsed(allPlayers, teamfights) {
  if (Array.isArray(teamfights) && teamfights.length > 0) return true;
  if (!Array.isArray(allPlayers)) return false;
  return allPlayers.some(p =>
    (typeof p.obs_placed === 'number' && p.obs_placed > 0) ||
    (typeof p.sen_placed === 'number' && p.sen_placed > 0) ||
    (typeof p.neutral_kills === 'number' && p.neutral_kills > 0) ||
    (Array.isArray(p.gold_t) && p.gold_t.length > 5) ||
    (Array.isArray(p.purchase_log) && p.purchase_log.length > 0)
  );
}

/**
 * Парсинг реальных ролей со старта матча (0–10 мин) + детектор «Позиция 6 (🌲 Лесник)» (v5.3)
 * 1) Не позволяет пятерке/четверке через лес (например, Doom с Midas) перезаписать настоящего керри (Pos 1) из-за итогового Net Worth.
 * 2) Опирается на парсинг линии (lane_role 1..4, lh_t[10], lane_efficiency, lane_kills vs neutral_kills, покупку стартовых вардов).
 * 3) Если 4-я или 5-я позиция с первых минут фармит лесных крипов (lane_role === 4 или доминирование neutral_kills при игноре линии и вардов),
 *    выдает игроку специальную роль: Позиция 6 — «Лесник (Pos 6 🌲)».
 * 4) Если это нераспарсенный матч или Immortal Draft без разметки линий, аккуратно восстанавливает позиции 1..5 (и 6 при наличии 4-го кора-лесника).
 */
function isPlayerEarlyJungler(p, durationMin) {
  const totalLh = Math.max(0, p.last_hits || 0);
  const neutralKills = p.neutral_kills ?? p.neutrals_killed ?? 0;
  const laneKills = typeof p.lane_kills === "number" ? p.lane_kills : Math.max(0, totalLh - neutralKills);
  const jungleRatio = totalLh > 25 ? neutralKills / Math.max(1, totalLh) : 0;
  const wards = (p.obs_placed || 0) + (p.sen_placed || 0);
  const laneEff = typeof p.lane_efficiency === "number" ? p.lane_efficiency : null;
  const lhAt10 = Array.isArray(p.lh_t) && p.lh_t.length > 10 ? p.lh_t[10] : null;

  // Прямой маркер парсера реплеев OpenDota: lane_role === 4 означает, что игрок с 0 по 10 минуту провел в лесу!
  if (Number(p.lane_role) === 4 && totalLh >= 50) {
    return true;
  }

  // Если есть точная статистика нейтральных крипов: убил больше нейтралов, чем линейных крипов (или >= 52% леса), не ставил варды как саппорт
  if (neutralKills >= 60 && jungleRatio >= 0.50 && wards <= 5) {
    if (laneEff !== null && laneEff < 0.42) return true;
    if (laneKills < neutralKills) return true;
  }

  // Если на 10-й минуте уже есть 28+ крипов, но эффективность золота с линии < 35% — значит, эти крипы набиты в лесу с 0-й минуты!
  if (lhAt10 !== null && lhAt10 >= 28 && laneEff !== null && laneEff < 0.35 && wards <= 4) {
    return true;
  }

  return false;
}

function inferTeamRoles(teamPlayers, durationMin) {
  const posLabels = {
    1: "Керри (Pos 1)",
    2: "Мидер (Pos 2)",
    3: "Оффлейнер (Pos 3)",
    4: "Поддержка (Pos 4)",
    5: "Полная поддержка (Pos 5)",
    6: "Лесник (Pos 6 🌲)"
  };

  // Оценка приоритета настоящего линейного кора на 0-10 минуте (чтобы лесник с Мидасом НЕ украл Pos 1 у керри!)
  const earlyLaneCorePriority = (x, targetPos = 1) => {
    const meta = HEROES_DB[x.hero_id] || { isSupport: false };
    const wards = (x.obs_placed || 0) + (x.sen_placed || 0);
    const totalLh = Math.max(0, x.last_hits || 0);
    const neutralKills = x.neutral_kills ?? x.neutrals_killed ?? 0;
    const laneKills = typeof x.lane_kills === "number" ? x.lane_kills : Math.max(0, totalLh - neutralKills);
    const jungleRatio = totalLh > 25 ? neutralKills / Math.max(1, totalLh) : 0;
    const lhAt10 = Array.isArray(x.lh_t) && x.lh_t.length > 10 ? x.lh_t[10] : null;
    const laneEff = typeof x.lane_efficiency === "number" ? x.lane_efficiency : null;
    const pLog = Array.isArray(x.purchase_log) ? x.purchase_log : [];
    const boughtEarlyWards = pLog.some(e => e && e.time <= 300 && (e.key === "ward_observer" || e.key === "ward_sentry"));

    let score = 0;
    // 1. Добитые крипы на самой линии (а не в лесу!)
    if (lhAt10 !== null) score += lhAt10 * 42;
    score += laneKills * 16;
    if (laneEff !== null) score += laneEff * 2600;

    // 2. Жесткий штраф к приоритету линейного кора, если игрок стоял в лесу (lane_role === 4) или бил в основном нейтралов
    if (Number(x.lane_role) === 4) score -= 6000;
    if (jungleRatio >= 0.52) score -= 2400;
    if (x.is_roaming) score -= 2200;

    // 3. Варды и саппорт-закуп
    score -= wards * 220;
    if (boughtEarlyWards) score -= 1400;

    // 4. Профиль героя (чтобы условный Doom/NP/Veno через лес не вытеснил Луну/Сларка/ПА/Дровку с Pos 1)
    if (targetPos === 1 && PURE_POS1_CARRY_HERO_IDS.has(x.hero_id)) score += 2600;
    if (meta.isSupport) score -= 3000;

    // 5. Общий фарм как мягкий тай-брейкер
    score += (x.net_worth || 0) * 0.15 + (x.gold_per_min || 0) * 4;
    return score;
  };

  const generalCoreScore = (x) => {
    const meta = HEROES_DB[x.hero_id] || { isSupport: false };
    const wards = (x.obs_placed || 0) + (x.sen_placed || 0);
    return (
      (x.net_worth || 0) * 0.45 +
      (x.gold_per_min || 0) * 12 +
      (x.last_hits || 0) * 18 +
      (PURE_POS1_CARRY_HERO_IDS.has(x.hero_id) ? 1800 : 0) -
      wards * 180 -
      (meta.isSupport ? 1800 : 0)
    );
  };

  const assigned = new Map();
  const hasStratzPositions = teamPlayers.filter(x => Number(x.stratz_position || 0) >= 1 && Number(x.stratz_position || 0) <= 5).length >= 3;
  const hasParsedLanes = teamPlayers.filter(x => Number(x.lane_role || 0) >= 1 && Number(x.lane_role || 0) <= 4).length >= 3;

  if (hasStratzPositions) {
    for (const p of teamPlayers) {
      const sPos = Number(p.stratz_position || 0);
      if (sPos >= 1 && sPos <= 3) {
        assigned.set(p.player_slot, { position: sPos, roleLabel: posLabels[sPos], isJungler: false, confidence: 99 });
      } else if ((sPos === 4 || sPos === 5) && isPlayerEarlyJungler(p, durationMin)) {
        assigned.set(p.player_slot, { position: 6, roleLabel: posLabels[6], isJungler: true, confidence: 96 });
      } else if (sPos === 4 || sPos === 5) {
        assigned.set(p.player_slot, { position: sPos, roleLabel: posLabels[sPos], isJungler: false, confidence: 98 });
      }
    }
    if (assigned.size === teamPlayers.length) {
      return assigned;
    }
  }

  if (hasParsedLanes) {
    // А) ПАРСИНГ РОЛЕЙ ПО ЛИНИЯМ (Когда в матче есть данные о линиях 0-10 мин)
    const lane = x => Number(x.lane_role || 0);

    // 1. Мидер (Pos 2): линия 2 (не роумер)
    const midCandidates = teamPlayers
      .filter(x => lane(x) === 2 && !x.is_roaming)
      .sort((a, b) => earlyLaneCorePriority(b, 2) - earlyLaneCorePriority(a, 2));
    if (midCandidates.length > 0) {
      assigned.set(midCandidates[0].player_slot, {
        position: 2,
        roleLabel: posLabels[2],
        isJungler: false,
        confidence: 98
      });
    }

    // 2. Керри (Pos 1) на легкой линии (lane_role === 1)
    const safeCandidates = teamPlayers
      .filter(x => lane(x) === 1 && !assigned.has(x.player_slot))
      .sort((a, b) => earlyLaneCorePriority(b, 1) - earlyLaneCorePriority(a, 1));
    if (safeCandidates.length > 0) {
      assigned.set(safeCandidates[0].player_slot, {
        position: 1,
        roleLabel: posLabels[1],
        isJungler: false,
        confidence: 96
      });
    }

    // 3. Оффлейнер (Pos 3) на сложной линии (lane_role === 3)
    const offCandidates = teamPlayers
      .filter(x => lane(x) === 3 && !assigned.has(x.player_slot))
      .sort((a, b) => earlyLaneCorePriority(b, 3) - earlyLaneCorePriority(a, 3));
    if (offCandidates.length > 0) {
      assigned.set(offCandidates[0].player_slot, {
        position: 3,
        roleLabel: posLabels[3],
        isJungler: false,
        confidence: 96
      });
    }

    // Если какая-то из кор-позиций (1, 2, 3) осталась пустой (например дабл-мид или трипла), заполняем лучшим оставшимся не-лесником
    for (const corePos of [1, 2, 3]) {
      const alreadyHasPos = [...assigned.values()].some(v => v.position === corePos);
      if (!alreadyHasPos) {
        const remNonJungle = teamPlayers
          .filter(x => !assigned.has(x.player_slot) && lane(x) !== 4)
          .sort((a, b) => earlyLaneCorePriority(b, corePos) - earlyLaneCorePriority(a, corePos));
        if (remNonJungle.length > 0) {
          assigned.set(remNonJungle[0].player_slot, {
            position: corePos,
            roleLabel: posLabels[corePos],
            isJungler: false,
            confidence: 84
          });
        }
      }
    }

    // 4. Теперь проверяем оставшихся двух игроков (номинальные Pos 4 и Pos 5):
    // Если кто-то из них с 0-й минуты ушел в лес (isPlayerEarlyJungler === true) — выдаем ему Позицию 6 (🌲 Лесник)!
    const supportOrJungleRem = teamPlayers
      .filter(x => !assigned.has(x.player_slot))
      .sort((a, b) => generalCoreScore(b) - generalCoreScore(a));

    for (let i = 0; i < supportOrJungleRem.length; i++) {
      const p = supportOrJungleRem[i];
      if (isPlayerEarlyJungler(p, durationMin)) {
        assigned.set(p.player_slot, {
          position: 6,
          roleLabel: posLabels[6],
          isJungler: true,
          confidence: 95
        });
      }
    }

    // Оставшимся саппортам раздаем Pos 4 и Pos 5 (по линии или вардам/фарму)
    const stillUnassigned = teamPlayers
      .filter(x => !assigned.has(x.player_slot))
      .sort((a, b) => generalCoreScore(b) - generalCoreScore(a));

    if (stillUnassigned.length === 2) {
      // Если один стоял в харде (lane 3) или роумил, а другой в изи-лейне (lane 1) — распределяем точно по линии!
      const p0 = stillUnassigned[0];
      const p1 = stillUnassigned[1];
      if (lane(p1) === 3 && lane(p0) === 1) {
        assigned.set(p1.player_slot, { position: 4, roleLabel: posLabels[4], isJungler: false, confidence: 94 });
        assigned.set(p0.player_slot, { position: 5, roleLabel: posLabels[5], isJungler: false, confidence: 94 });
      } else {
        assigned.set(p0.player_slot, { position: 4, roleLabel: posLabels[4], isJungler: false, confidence: 90 });
        assigned.set(p1.player_slot, { position: 5, roleLabel: posLabels[5], isJungler: false, confidence: 90 });
      }
    } else if (stillUnassigned.length === 1) {
      const p0 = stillUnassigned[0];
      const posToGive = lane(p0) === 3 ? 4 : 5;
      assigned.set(p0.player_slot, { position: posToGive, roleLabel: posLabels[posToGive], isJungler: false, confidence: 90 });
    }
  } else {
    // Б) УГАДЫВАНИЕ РОЛЕЙ (Только для Immortal Draft / нераспарсенных матчей, где нет lane_role!)
    // Сортируем с учетом профильных керри (PURE_POS1_CARRY_HERO_IDS), чтобы лесной Doom не стал Pos 1 вместо настоящего керри
    const sorted = [...teamPlayers].sort((a, b) => earlyLaneCorePriority(b, 1) - earlyLaneCorePriority(a, 1));

    // Находим лучшего кандидата на Pos 1 (приоритет PURE_POS1_CARRY_HERO_IDS)
    const carryCandidate = [...teamPlayers]
      .filter(p => (p.last_hits || 0) >= 80)
      .sort((a, b) => {
        const aCarry = PURE_POS1_CARRY_HERO_IDS.has(a.hero_id) ? 1 : 0;
        const bCarry = PURE_POS1_CARRY_HERO_IDS.has(b.hero_id) ? 1 : 0;
        if (bCarry !== aCarry) return bCarry - aCarry;
        return generalCoreScore(b) - generalCoreScore(a);
      })[0] || sorted[0];

    if (carryCandidate) {
      assigned.set(carryCandidate.player_slot, { position: 1, roleLabel: posLabels[1], isJungler: false, confidence: 78 });
    }

    const remAfterCarry = sorted.filter(p => !assigned.has(p.player_slot));
    if (remAfterCarry[0]) {
      assigned.set(remAfterCarry[0].player_slot, { position: 2, roleLabel: posLabels[2], isJungler: false, confidence: 75 });
    }
    if (remAfterCarry[1]) {
      assigned.set(remAfterCarry[1].player_slot, { position: 3, roleLabel: posLabels[3], isJungler: false, confidence: 75 });
    }

    // Проверяем 4-го и 5-го игроков на предмет ухода в лес (Pos 6 🌲 Лесник) в нераспарсенном матче
    for (const p of remAfterCarry.slice(2)) {
      const wards = (p.obs_placed || 0) + (p.sen_placed || 0);
      const lhPerMin = (p.last_hits || 0) / Math.max(1, durationMin);
      const looksLikeFourthCoreJungler =
        isPlayerEarlyJungler(p, durationMin) ||
        (JUNGLE_CAPABLE_HERO_IDS.has(p.hero_id) && lhPerMin >= 4.2 && wards <= 3 && (p.gold_per_min || 0) >= 400);

      if (looksLikeFourthCoreJungler) {
        assigned.set(p.player_slot, { position: 6, roleLabel: posLabels[6], isJungler: true, confidence: 85 });
      }
    }

    const remSupports = remAfterCarry.slice(2).filter(p => !assigned.has(p.player_slot));
    if (remSupports[0]) {
      assigned.set(remSupports[0].player_slot, { position: 4, roleLabel: posLabels[4], isJungler: false, confidence: 72 });
    }
    if (remSupports[1]) {
      assigned.set(remSupports[1].player_slot, { position: 5, roleLabel: posLabels[5], isJungler: false, confidence: 72 });
    }
  }

  return assigned;
}

function detectRole(player, durationMin, teamPlayers) {
  const heroMeta = HEROES_DB[player.hero_id] || { name: `Hero #${player.hero_id}`, isSupport: false, spellcaster: false, pusher: false };
  const roleMap = inferTeamRoles(teamPlayers, durationMin);
  const inferred = roleMap.get(player.player_slot) || {
    position: 5,
    roleLabel: "Полная поддержка (Pos 5)",
    isJungler: false,
    confidence: 60
  };

  const isSupport = inferred.position === 4 || inferred.position === 5;
  const isJungler = inferred.position === 6 || Boolean(inferred.isJungler);

  return {
    position: inferred.position,
    isSupport,
    isJungler,
    isSpellcaster: Boolean(heroMeta.spellcaster),
    isPusher: Boolean(heroMeta.pusher),
    roleLabel: inferred.roleLabel,
    roleConfidence: inferred.confidence,
    farmRank: inferred.position,
    heroName: player.hero_name || heroMeta.name,
    bigUlt: heroMeta.bigUlt || null,
    ultLabel: heroMeta.ultLabel || null,
    ultCd: heroMeta.ultCd || 110
  };
}

function findItemPurchaseEntry(itemId, meta, purchaseLog) {
  if (!Array.isArray(purchaseLog) || purchaseLog.length === 0) return null;
  const candidateKeys = new Set();
  if (meta && meta.slug) candidateKeys.add(meta.slug);
  if (ITEM_PURCHASE_KEY_ALIASES[itemId]) {
    for (const k of ITEM_PURCHASE_KEY_ALIASES[itemId]) candidateKeys.add(k);
  }
  const matches = purchaseLog.filter(p => p && candidateKeys.has(p.key));
  if (matches.length === 0) return null;
  return matches[0];
}

function auditInventory(player, mainItems, roleInfo, durationMin, netWorth, purchaseLog = []) {
  const richItems = mainItems.map(id => {
    const meta = ITEMS_DB[id];
    const purchaseEntry = findItemPurchaseEntry(id, meta, purchaseLog);
    const boughtAtSec = purchaseEntry && typeof purchaseEntry.time === 'number' ? purchaseEntry.time : null;
    const boughtAt = boughtAtSec !== null && boughtAtSec >= 0 ? formatClock(boughtAtSec) : (boughtAtSec !== null ? '00:00' : null);
    const boughtAtMin = boughtAtSec !== null ? `${Math.max(1, Math.round(Math.max(0, boughtAtSec) / 60))}м` : null;

    return {
      id,
      name: meta ? meta.name : `Предмет #${id}`,
      slug: meta ? meta.slug : null,
      img: meta ? meta.img : null,
      cost: meta ? meta.cost : 1500,
      boots: meta ? Boolean(meta.boots) : false,
      major: meta ? Boolean(meta.major) : id >= 100,
      boughtAtSec,
      boughtAt,
      boughtAtMin,
      timingStatus: 'ok',
      timingNote: boughtAt ? `Куплен на ${boughtAt}` : null
    };
  });

  const hasBkbInInventory = mainItems.includes(116);
  const majorItemsCount = richItems.filter(i => i.major).length;
  const bootsItems = richItems.filter(i => i.boots);
  const cheapFillerItems = richItems.filter(i => !i.boots && !i.major && (i.cost || 0) <= 1400);

  // Подсчет дубликатов одинаковых предметов (например 3 Bracer / 2 сапога / 4 ветки / 2 MoM)
  const itemCountsById = {};
  for (const id of mainItems) {
    itemCountsById[id] = (itemCountsById[id] || 0) + 1;
  }
  const maxDuplicateSameItem = Math.max(0, ...Object.values(itemCountsById));

  // Детектор абсурдного закупа / троллинга сборкой на кор-ролях (Pos 1–3)
  const hasMultipleBoots = bootsItems.length >= 2;
  const hasTrashSpamAtHighNw =
    !roleInfo.isSupport &&
    durationMin >= 20 &&
    netWorth >= 13500 &&
    ((majorItemsCount === 0 && mainItems.length >= 3) ||
     (majorItemsCount <= 1 && (cheapFillerItems.length >= 3 || maxDuplicateSameItem >= 3)));

  const isTrollOrAbsurdBuild = !roleInfo.isSupport && durationMin >= 18 && (
    (hasMultipleBoots && netWorth >= 10000) ||
    hasTrashSpamAtHighNw
  );

  let trollBuildReason = null;
  if (hasMultipleBoots && !roleInfo.isSupport && netWorth >= 10000) {
    trollBuildReason = `Несколько ботинок в инвентаре (${bootsItems.map(b => b.name).join(', ')}) при нетворсе ${netWorth.toLocaleString('ru-RU')} 🪙`;
  } else if (hasTrashSpamAtHighNw) {
    trollBuildReason = `При нетворсе ${netWorth.toLocaleString('ru-RU')} 🪙 инвентарь забит дешевыми аксессуарами/дубликатами (${richItems.map(i => i.name).join(', ')}) почти без кор-артефактов`;
  }

  const expectedNwPerMinByPos = {
    1: 430,
    2: 400,
    3: 350,
    4: 220,
    5: 170
  };
  const expectedNw = Math.round((expectedNwPerMinByPos[roleInfo.position] || 320) * durationMin);
  const nwDeficitPct = expectedNw > 0 ? Math.round(((expectedNw - netWorth) / expectedNw) * 100) : 0;

  const isSeverelyUndergeared =
    !roleInfo.isSupport &&
    durationMin >= 22 &&
    ((nwDeficitPct >= 25 && majorItemsCount <= 2) || (nwDeficitPct >= 28 && (player.deaths || 0) >= 11));

  return {
    richItems,
    hasBkbInInventory,
    majorItemsCount,
    bootsCount: bootsItems.length,
    cheapFillerCount: cheapFillerItems.length,
    isTrollOrAbsurdBuild,
    trollBuildReason,
    expectedNw,
    nwDeficitPct,
    isSeverelyUndergeared
  };
}

// Вспомогательная функция: собирает все предметы игрока (6 слотов + ранец + нейтралка + съеденный Аганим/Шард/Муншард)
function getPlayerAllItemIds(p) {
  if (!p) return [];
  const raw = [
    p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5,
    p.backpack_0, p.backpack_1, p.backpack_2,
    p.item_neutral
  ].map(x => Number(x || 0)).filter(x => x > 0);
  if (p.aghanims_scepter === 1 && !raw.includes(108)) raw.push(108);
  if (p.aghanims_shard === 1 && !raw.includes(609)) raw.push(609);
  if (p.moonshard === 1 && !raw.includes(247)) raw.push(247);
  return [...new Set(raw)];
}

// ============================================================================
// АРХИТЕКТУРА 6 ТОЧНЫХ БОЕВЫХ АРХЕТИПОВ + ДИНАМИЧЕСКИЕ ГИБРИДЫ (v6.0)
// ============================================================================
const MID_RIGHTCLICKER_HERO_IDS = new Set([
  10, // Morphling
  11, // Shadow Fiend
  21, // Windranger
  25, // Lina
  35, // Sniper
  46, // Templar Assassin
  59, // Huskar
  76, // Outworld Destroyer
  113, // Arc Warden
  138  // Muerta
]);

const MID_SPELLCASTER_HERO_IDS = new Set([
  13,  // Puck
  17,  // Storm Spirit
  22,  // Zeus
  34,  // Tinker
  36,  // Necrophos
  39,  // Queen of Pain
  43,  // Death Prophet
  52,  // Leshrac
  65,  // Batrider
  74,  // Invoker (по базе кастер, переходит в райткликера только при покупке физ-ДПС слотов)
  86,  // Rubick
  101, // Skywrath Mage
  106, // Ember Spirit
  107, // Earth Spirit
  120, // Pangolier
  126, // Void Spirit
  137  // Primal Beast
]);

// Строгий список гибридных героев, которые могут собираться И в физ-урон с руки, И в маг-прокаст/кд заклинаний
// (Чистые керри вроде Anti-Mage сюда НЕ входят во избежание ложных срабатываний)
const HYBRID_FLEX_DAMAGE_HERO_IDS = new Set([
  9,   // Mirana
  10,  // Morphling
  11,  // Shadow Fiend
  15,  // Razor
  21,  // Windranger
  25,  // Lina
  39,  // Queen of Pain
  47,  // Viper
  53,  // Nature's Prophet
  74,  // Invoker
  102, // Abaddon
  113, // Arc Warden
  123, // Hoodwink
  126, // Void Spirit
  138  // Muerta
]);

// Предметы, однозначно определяющие сборку гибридного героя в Мага-кастера (Spellcaster)
const SPELLCASTER_BUILD_ITEM_IDS = new Set([
  108,  // Aghanim's Scepter
  110,  // Refresher Orb
  119,  // Shiva's Guard
  121,  // Bloodstone
  176,  // Ethereal Blade
  201,  // Dagon 2
  202,  // Dagon 3
  203,  // Dagon 4
  204,  // Dagon 5
  223,  // Meteor Hammer
  232,  // Aether Lens
  235,  // Octarine Core
  259,  // Kaya and Sange
  273,  // Kaya
  277,  // Yasha and Kaya
  604,  // Arcane Blink
  610,  // Wind Waker
  692,  // Eternal Shroud
  1100  // Phylactery
]);

// Предметы чистого физического ДПС с руки (без учета нейтральных утилити-слотов вроде Blink, BKB, Midas, Boots of Travel)
const TRUE_PHYSICAL_DPS_ITEM_IDS = new Set([
  135,  // Monkey King Bar
  139,  // Butterfly
  141,  // Daedalus
  145,  // Battle Fury
  147,  // Manta Style
  149,  // Crystalys
  151,  // Armlet of Mordiggian
  154,  // Sange and Yasha
  156,  // Satanic
  158,  // Mjollnir
  160,  // Eye of Skadi
  166,  // Maelstrom
  168,  // Desolator
  172,  // Mask of Madness
  174,  // Diffusal Blade
  208,  // Abyssal Blade
  225,  // Nullifier
  236,  // Dragon Lance
  249,  // Silver Edge
  250,  // Bloodthorn
  252,  // Echo Sabre
  534,  // Witch Blade
  597,  // Parasma
  603,  // Swift Blink
  939,  // Harpoon
  1097, // Disperser
  1164, // Parasma
  1806  // Parasma
]);

const OFFLANE_DUELIST_HERO_IDS = new Set([
  4,   // Bloodseeker
  15,  // Razor
  28,  // Slardar
  38,  // Beastmaster
  47,  // Viper
  60,  // Night Stalker
  77,  // Lycan
  104, // Legion Commander
  136  // Marci
]);

const OFFLANE_TANK_INITIATOR_HERO_IDS = new Set([
  2,   // Axe
  7,   // Earthshaker
  16,  // Sand King
  19,  // Tiny
  23,  // Kunkka
  29,  // Tidehunter
  49,  // Dragon Knight
  51,  // Clockwerk
  55,  // Dark Seer
  69,  // Doom
  71,  // Spirit Breaker
  78,  // Brewmaster
  83,  // Treant Protector
  85,  // Undying
  96,  // Centaur Warrunner
  97,  // Magnus
  98,  // Timbersaw
  99,  // Bristleback
  103, // Elder Titan
  108, // Underlord
  110, // Phoenix
  129, // Mars
  135, // Dawnbreaker
  146  // Largo
]);

const RIGHT_CLICK_ITEM_INDICATORS = new Set([
  63, 172, 236, 263, 147, 154, 168, 149, 141, 139, 156, 249, 152, 135, 250, 225,
  603, 112, 145, 158, 166, 160, 939, 252, 151, 208, 143, 174, 1097, 596
]);

// Пул героев, которые по мете собирают Monkey King Bar / Bloodthorn для физ-урона с руки
const META_MKB_CARRIER_HERO_IDS = new Set([
  1, 4, 6, 8, 9, 10, 11, 15, 18, 21, 25, 35, 41, 42, 44, 46, 47, 48, 49,
  53, 54, 56, 59, 61, 63, 70, 72, 73, 74, 76, 93, 94, 95, 104, 109, 113, 114, 136, 138, 145
]);

// Пул физ-коров и охотников, которые по мете обязаны собирать Nullifier против сейвов врага (включая Clinkz #56, PA #44, Jugg #8, Slark #93, Ursa #70 и др.)
const META_NULLIFIER_CARRIER_HERO_IDS = new Set([
  1, 4, 8, 11, 12, 18, 19, 21, 28, 32, 41, 42, 44, 46, 53, 54, 56, 60, 61,
  63, 67, 70, 73, 81, 93, 95, 104, 113, 114, 136, 145
]);

const PURGEABLE_INNATE_SAVE_HEROES = {
  36: "Necrophos (Ghost Shroud)",
  45: "Pugna (Decrepify)",
  57: "Omniknight (Guardian Angel)",
  21: "Windranger (Windrun)"
};

const OFFENSIVE_EULS_INITIATOR_HERO_IDS = new Set([
  2, 7, 16, 23, 64, 71, 96, 97, 103, 129, 137
]);

const HIGH_INNATE_EVASION_HEROES = {
  44: { label: "Phantom Assassin (Blur 50%)", weight: 1.15, dispellableByNullifier: false },
  21: { label: "Windranger (Windrun 100%)", weight: 0.90, dispellableByNullifier: true },
  113: { label: "Arc Warden (Magnetic Field 100%)", weight: 0.85, dispellableByNullifier: false },
  78: { label: "Brewmaster (Drunken Brawler)", weight: 0.70, dispellableByNullifier: false }
};

const BLIND_OR_MISS_HEROES = {
  32: { label: "Riki (Smoke Screen)", weight: 0.15, counteredByDispel: false, counteredByForceOrBkb: true },
  95: { label: "Troll Warlord (Whirling Axes)", weight: 0.20, counteredByDispel: true },
  123: { label: "Hoodwink (Scurry)", weight: 0.25, counteredByDispel: false },
  61: { label: "Broodmother (Incapacitating Bite)", weight: 0.20, counteredByDispel: true },
  90: { label: "Keeper of the Light (Blinding Light)", weight: 0.15, counteredByDispel: true },
  34: { label: "Tinker (Laser)", weight: 0.20, counteredByDispel: true }
};

const CRITICAL_PASSIVE_BOSS_HEROES = {
  99: "Bristleback (Bristleback)",
  67: "Spectre (Dispersion)",
  98: "Timbersaw (Reactive Armor)"
};

const SECONDARY_PASSIVE_HEROES = {
  44: "Phantom Assassin (Blur)",
  29: "Tidehunter (Kraken Shell)",
  102: "Abaddon (Curse of Avernus)",
  49: "Dragon Knight (Dragon Blood)",
  108: "Underlord (Atrophy Aura)"
};

const SILVER_EDGE_CARRIER_HERO_IDS = new Set([
  4, 6, 11, 18, 19, 23, 25, 28, 35, 42, 46, 47, 49, 53, 54, 56, 63, 73, 81, 93, 95, 104, 113, 114, 138, 145
]);

const HEAVY_SUSTAIN_HEROES = {
  59: "Huskar",
  73: "Alchemist",
  10: "Morphling",
  36: "Necrophos",
  91: "Io",
  99: "Bristleback",
  98: "Timbersaw",
  54: "Lifestealer",
  93: "Slark",
  96: "Centaur Warrunner",
  14: "Pudge",
  102: "Abaddon",
  52: "Leshrac",
  43: "Death Prophet",
  42: "Wraith King",
  114: "Monkey King"
};

const ILLUSION_OR_SWARM_HEROES = {
  12: "Phantom Lancer",
  89: "Naga Siren",
  81: "Chaos Knight",
  82: "Meepo",
  61: "Broodmother",
  109: "Terrorblade"
};

const INNATE_AOE_CLEAR_HERO_IDS = new Set([
  2, 7, 16, 18, 22, 23, 25, 29, 36, 48, 52, 55, 64, 72, 74, 87, 94, 96, 97, 98, 106, 108, 110, 120, 128, 129, 135, 137
]);

const HEAVY_MAGIC_BURST_HERO_IDS = new Set([
  7, 13, 16, 17, 22, 25, 26, 30, 31, 34, 36, 39, 40, 43, 45, 52, 64, 68, 74, 76, 84, 86, 87, 88, 98, 101, 105, 106, 110, 119, 121, 126, 128, 137, 138
]);

const GREEDY_SUPPORT_CARRY_ITEM_IDS = new Set([
  65, 135, 137, 139, 141, 145, 147, 151, 152, 156, 158, 160, 166, 168, 201, 202, 203, 204, 247, 249, 250, 1107
]);

/**
 * Пункт 1: Динамическое определение архетипа (с проверкой текущего закупа для гибридных героев: Invoker, SF, Lina, WR, NP и др.)
 */
function detectPlayerBuildArchetype(player, roleInfo, allItemIds = []) {
  const hId = Number(player.hero_id);
  const pos = Number(roleInfo.position || 5);
  const isRanged = RANGED_HERO_IDS.has(hId);

  const spellcasterItemsCount = allItemIds.filter(id => SPELLCASTER_BUILD_ITEM_IDS.has(id)).length;
  const physicalDpsItemsCount = allItemIds.filter(id => TRUE_PHYSICAL_DPS_ITEM_IDS.has(id)).length;
  const isHybridHero = HYBRID_FLEX_DAMAGE_HERO_IDS.has(hId);

  // Для гибридных героев (Invoker, SF, Lina, WR и др.): если собраны Octarine Core, Meteor Hammer, Aghanim's Scepter, Kaya, Refresher, Shiva's Guard
  // и нет перевеса в физические ДПС-слоты — классифицируем строго как Мага-кастера (MID_SPELLCASTER)!
  const hybridBuiltAsSpellcaster =
    isHybridHero &&
    ((spellcasterItemsCount >= 1 && physicalDpsItemsCount === 0) ||
     (spellcasterItemsCount >= 2 && spellcasterItemsCount >= physicalDpsItemsCount));

  const hybridBuiltAsRightClicker =
    isHybridHero &&
    physicalDpsItemsCount >= 1 &&
    physicalDpsItemsCount > spellcasterItemsCount;

  if (pos === 4 || pos === 5 || roleInfo.isSupport) {
    return {
      archetypeKey: "SUPPORT_UTILITY",
      archetypeLabel: "Саппорт / Утилити",
      isPhysicalRightClicker: false,
      hasPureMagicCombo: false,
      isRanged
    };
  }

  if (pos === 6 || roleInfo.isJungler) {
    return {
      archetypeKey: "OFFLANE_TANK_INITIATOR",
      archetypeLabel: "Лесной фармер (Pos 6 🌲)",
      isPhysicalRightClicker: false,
      hasPureMagicCombo: false,
      isRanged
    };
  }

  // На 1-й позиции (Pos 1): чистые керри всегда CARRY_STRIKER, а гибриды (например SF/Lina/NP) проверяются по закупу
  if (pos === 1) {
    if (hybridBuiltAsSpellcaster || (MID_SPELLCASTER_HERO_IDS.has(hId) && physicalDpsItemsCount === 0)) {
      return {
        archetypeKey: "MID_SPELLCASTER",
        archetypeLabel: "Маг-темповик / Кастер",
        isPhysicalRightClicker: false,
        hasPureMagicCombo: true,
        isRanged
      };
    }
    return {
      archetypeKey: "CARRY_STRIKER",
      archetypeLabel: "Физ-керри / Страйкер (Pos 1)",
      isPhysicalRightClicker: true,
      hasPureMagicCombo: false,
      isRanged
    };
  }

  // На 2-й позиции (Pos 2 — Мидер):
  if (pos === 2) {
    if (hybridBuiltAsSpellcaster) {
      return {
        archetypeKey: "MID_SPELLCASTER",
        archetypeLabel: "Маг-темповик / Кастер",
        isPhysicalRightClicker: false,
        hasPureMagicCombo: true,
        isRanged
      };
    }
    if (hybridBuiltAsRightClicker) {
      return {
        archetypeKey: "MID_RIGHTCLICKER",
        archetypeLabel: "ДПС-Мидер / Стрелок (Pos 2)",
        isPhysicalRightClicker: true,
        hasPureMagicCombo: false,
        isRanged
      };
    }
    if (MID_SPELLCASTER_HERO_IDS.has(hId)) {
      return {
        archetypeKey: "MID_SPELLCASTER",
        archetypeLabel: "Маг-темповик / Кастер",
        isPhysicalRightClicker: false,
        hasPureMagicCombo: true,
        isRanged
      };
    }
    if (OFFLANE_TANK_INITIATOR_HERO_IDS.has(hId) && !MID_RIGHTCLICKER_HERO_IDS.has(hId)) {
      return {
        archetypeKey: "OFFLANE_TANK_INITIATOR",
        archetypeLabel: "Танк / Инициатор (Pos 3)",
        isPhysicalRightClicker: false,
        hasPureMagicCombo: false,
        isRanged
      };
    }
    if (MID_RIGHTCLICKER_HERO_IDS.has(hId) || PURE_POS1_CARRY_HERO_IDS.has(hId) || physicalDpsItemsCount >= 2) {
      return {
        archetypeKey: "MID_RIGHTCLICKER",
        archetypeLabel: "ДПС-Мидер / Стрелок (Pos 2)",
        isPhysicalRightClicker: true,
        hasPureMagicCombo: false,
        isRanged
      };
    }
    return {
      archetypeKey: "MID_SPELLCASTER",
      archetypeLabel: "Маг-темповик / Кастер",
      isPhysicalRightClicker: false,
      hasPureMagicCombo: true,
      isRanged
    };
  }

  // На 3-й позиции (Pos 3 — Оффлейнер):
  if (hybridBuiltAsSpellcaster) {
    return {
      archetypeKey: "MID_SPELLCASTER",
      archetypeLabel: "Маг-темповик / Кастер",
      isPhysicalRightClicker: false,
      hasPureMagicCombo: true,
      isRanged
    };
  }

  if (OFFLANE_DUELIST_HERO_IDS.has(hId) || hybridBuiltAsRightClicker) {
    return {
      archetypeKey: "OFFLANE_DUELIST",
      archetypeLabel: "Оффлейн-дуэлянт / Охотник (Pos 3)",
      isPhysicalRightClicker: true,
      hasPureMagicCombo: false,
      isRanged
    };
  }

  if (MID_SPELLCASTER_HERO_IDS.has(hId) && !OFFLANE_TANK_INITIATOR_HERO_IDS.has(hId)) {
    return {
      archetypeKey: "MID_SPELLCASTER",
      archetypeLabel: "Маг-темповик / Кастер",
      isPhysicalRightClicker: false,
      hasPureMagicCombo: true,
      isRanged
    };
  }

  return {
    archetypeKey: "OFFLANE_TANK_INITIATOR",
    archetypeLabel: "Танк / Инициатор (Pos 3)",
    isPhysicalRightClicker: false,
    hasPureMagicCombo: false,
    isRanged
  };
}

function analyzeEnemyTargetThreats({
  player,
  roleInfo,
  buildArch,
  allPlayerItems,
  purchaseLog,
  enemyPlayers,
  durationSec,
  findEnemyItemTimeSec,
  isBoughtRightBeforeMatchEnd
}) {
  const hasItem = (id) => allPlayerItems.includes(id);
  const hasAnyItem = (ids) => ids.some(id => hasItem(id));

  const hasNullifier = hasItem(225);
  const hasTrueStrike = hasAnyItem([135, 250, 911]);
  const hasMjollnirOrGleipnir = hasAnyItem([158, 1466]);
  const hasHexOrAbyssal = hasAnyItem([96, 208]);
  const hasSelfDispelItem = hasAnyItem([147, 116, 156, 226, 1097, 610]);
  const hasInnateSpellImmunityOrDispel = INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS.has(Number(player.hero_id));
  const canDispelBlinds = hasSelfDispelItem || hasInnateSpellImmunityOrDispel;
  const hasForceOrPike = hasAnyItem([102, 263]);

  let totalUnresolvedEvasionWeight = 0;
  const unresolvedLabels = [];
  const resolvedNotes = [];
  const allDetectedEvasionLabels = [];
  const activeButterflyHolders = [];
  const activeRadianceHolders = [];

  for (const ep of (enemyPlayers || [])) {
    const hId = Number(ep.hero_id);
    const hName = (HEROES_DB[hId] && HEROES_DB[hId].name) || ep.hero_name || `Hero #${hId}`;
    const epItems = getPlayerAllItemIds(ep);
    const epHas = (id) => epItems.includes(id);

    const hasInnatePurgeableSave = Boolean(PURGEABLE_INNATE_SAVE_HEROES[hId]);
    const hasGhostOrEuls = epHas(37) || epHas(176) || epHas(100) || epHas(610);
    const targetReliesOnPurgeableSave = hasInnatePurgeableSave || hasGhostOrEuls;

    if (epHas(139)) {
      const tSec = findEnemyItemTimeSec(ep, [139]);
      if (!isBoughtRightBeforeMatchEnd(tSec)) {
        const lbl = `${hName} (Butterfly${tSec ? ` ${formatClock(tSec)}` : ""})`;
        activeButterflyHolders.push({ heroId: hId, heroName: hName, timeSec: tSec, label: lbl });
        allDetectedEvasionLabels.push(lbl);
        totalUnresolvedEvasionWeight += 1.05;
        unresolvedLabels.push(lbl);
      }
    }

    if (epHas(137)) {
      const tSec = findEnemyItemTimeSec(ep, [137]);
      if (!isBoughtRightBeforeMatchEnd(tSec)) {
        const lbl = `${hName} (Radiance${tSec ? ` ${formatClock(tSec)}` : ""})`;
        activeRadianceHolders.push({ heroId: hId, heroName: hName, timeSec: tSec, label: lbl });
        allDetectedEvasionLabels.push(lbl);

        if (targetReliesOnPurgeableSave && hasNullifier) {
          resolvedNotes.push(
            `Против ${hName} (Radiance) уже собран Nullifier — снимает ${PURGEABLE_INNATE_SAVE_HEROES[hId] || "сейв/гост"}, цель умирает за фокус без необходимости тратить 4700 🪙 и слот на MKB ради 25% миссов Радика`
          );
        } else if (hasMjollnirOrGleipnir && (hasNullifier || hasHexOrAbyssal || Number(player.hero_id) === 8)) {
          resolvedNotes.push(
            `25% миссов от Radiance на ${hName} перекрываются высокой скоростью атаки, молниями Mjollnir/Gleipnir и контролем — отдельный слот MKB нецелесообразен`
          );
        } else {
          totalUnresolvedEvasionWeight += 0.30;
          unresolvedLabels.push(lbl);
        }
      }
    }

    if (HIGH_INNATE_EVASION_HEROES[hId]) {
      const evMeta = HIGH_INNATE_EVASION_HEROES[hId];
      allDetectedEvasionLabels.push(evMeta.label);

      if (evMeta.dispellableByNullifier && hasNullifier) {
        resolvedNotes.push(
          `Против ${evMeta.label} уже куплен Nullifier, который снимает Windrun — покупка MKB не обязательна`
        );
      } else {
        totalUnresolvedEvasionWeight += evMeta.weight;
        unresolvedLabels.push(evMeta.label);
      }
    }

    if (BLIND_OR_MISS_HEROES[hId]) {
      const blindMeta = BLIND_OR_MISS_HEROES[hId];
      allDetectedEvasionLabels.push(blindMeta.label);

      if (blindMeta.counteredByDispel && canDispelBlinds) {
        resolvedNotes.push(
          `Ослепление от ${blindMeta.label} снимается ${hasInnateSpellImmunityOrDispel ? "встроенной механикой героя (Blade Fury / Rage / Dark Pact)" : "предметами диспела (Manta / BKB / Satanic / Lotus)"}`
        );
      } else if (blindMeta.counteredByForceOrBkb && (hasItem(116) || hasForceOrPike || hasInnateSpellImmunityOrDispel)) {
        resolvedNotes.push(
          `Против ${blindMeta.label} работают BKB / Force Staff / встроенный иммунитет, а не MKB`
        );
      } else {
        totalUnresolvedEvasionWeight += blindMeta.weight;
        unresolvedLabels.push(blindMeta.label);
      }
    }
  }

  const majorSlotsOwned = allPlayerItems.filter(id => ITEMS_DB[id] && (ITEMS_DB[id].major || ITEMS_DB[id].boots)).length;
  const isSlotConstrainedWithHighValueItems =
    majorSlotsOwned >= 5 && (hasNullifier || hasHexOrAbyssal || hasMjollnirOrGleipnir);

  if (totalUnresolvedEvasionWeight > 0 && totalUnresolvedEvasionWeight < 0.85 && isSlotConstrainedWithHighValueItems) {
    resolvedNotes.push(
      `Защита ценности слота (Slot Efficiency): при мелких источниках миссов (${unresolvedLabels.join(", ")}) слоты грамотно отданы под приоритетные задачи (${hasNullifier ? "Nullifier, " : ""}мобильность и выживаемость)`
    );
  }

  const mkbStrictlyRequired = totalUnresolvedEvasionWeight >= 0.85;

  return {
    totalUnresolvedEvasionWeight: Number(totalUnresolvedEvasionWeight.toFixed(2)),
    mkbStrictlyRequired,
    hasAnyEvasionOnMap: allDetectedEvasionLabels.length > 0,
    allDetectedEvasionLabels,
    unresolvedLabels,
    resolvedNotes,
    activeButterflyHolders,
    activeRadianceHolders,
    hasTrueStrike,
    hasNullifier,
    hasMjollnirOrGleipnir
  };
}

/**
 * Умный «Мини-ИИ Оценщик Билда и Матрица Контр-Закупа» (v6.0)
 * — С динамическими гибридами (Invoker/SF/Lina), привязкой MKB/Nullifier к пулу физ-коров (Clinkz, PA, Jugg, Slark, Ursa)
 * — С проверкой Hex / Orchid / Bloodthorn / Shiva's Guard у кастеров (MID_SPELLCASTER)
 * — С детектором троллинга сборкой на корах и жадного закупа без сейвов на саппортах
 */
function evaluateBuildAndTimings(player, roleInfo, invAudit, mainItems, purchaseLog, enemyPlayers, allPlayers, durationMin, netWorth, deaths, wonMatch) {
  const richItems = invAudit.richItems;
  const allPlayerItems = getPlayerAllItemIds(player);
  const hasItem = (id) => mainItems.includes(id) || allPlayerItems.includes(id);
  const hasAnyItem = (ids) => ids.some(id => hasItem(id));

  const allyPlayers = (allPlayers || []).filter(ap => (ap.player_slot < 128) === (player.player_slot < 128));
  const teamAllItemIds = new Set();
  for (const ap of allyPlayers) {
    for (const id of getPlayerAllItemIds(ap)) teamAllItemIds.add(id);
  }
  const teamHasAnyItem = (ids) => ids.some(id => teamAllItemIds.has(id));

  const buildArch = detectPlayerBuildArchetype(player, roleInfo, allPlayerItems);
  const arch = buildArch.archetypeKey;

  const teamHasAntiHeal =
    teamHasAnyItem([267, 160, 569]) ||
    allyPlayers.some(ap => [68, 69, 40].includes(Number(ap.hero_id)));

  const teamHasNullifier =
    teamHasAnyItem([225]) ||
    allyPlayers.some(ap => Number(ap.hero_id) === 79);

  const teamHasAuraSave =
    teamHasAnyItem([90, 242, 79, 231, 931, 226]);

  const teamHasBreak =
    teamHasAnyItem([249]) ||
    allyPlayers.some(ap =>
      Number(ap.hero_id) === 47 ||
      ([123, 79, 44].includes(Number(ap.hero_id)) && getPlayerAllItemIds(ap).includes(108))
    );

  const teamHasAoEClear =
    teamHasAnyItem([158, 145, 137, 1466, 119, 166]) ||
    allyPlayers.some(ap => INNATE_AOE_CLEAR_HERO_IDS.has(Number(ap.hero_id)));

  const metaProfile = getHeroMetaProfile(player.hero_id);
  const isInnateImmuneOrElusive = INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS.has(player.hero_id);
  const metaDispelItemsOwned = richItems.filter(i => META_DISPEL_OR_SAVE_ITEM_IDS.has(i.id));
  const hasMetaDispelOrSave = metaDispelItemsOwned.length > 0 || allPlayerItems.some(id => META_DISPEL_OR_SAVE_ITEM_IDS.has(id));
  const isExemptByInnateAndMetaDispel = isInnateImmuneOrElusive && hasMetaDispelOrSave;

  const kills = player.kills || 0;
  const assists = player.assists || 0;
  const durationSec = Math.round(durationMin * 60);
  const kdaRatio = (kills + assists) / Math.max(1, deaths);
  const playerGpm = player.gold_per_min || 0;
  const playerDpg = (player.hero_damage || 0) / Math.max(1, player.total_gold || (playerGpm * durationMin) || netWorth || 1);

  const isDominatingKillerCore = kills >= 12 && kills >= deaths + 4;
  const isHighImpactWinnerOrCarry = Boolean(wonMatch) || (kdaRatio >= 2.4 && playerDpg >= 1.05) || isDominatingKillerCore;

  // Привязка контр-предметов к реальному пулу героя по мете
  const heroPoolSupportsMkb =
    buildArch.isPhysicalRightClicker &&
    (META_MKB_CARRIER_HERO_IDS.has(Number(player.hero_id)) || metaProfile.topMetaItemIds.includes(135) || arch === "CARRY_STRIKER");

  const heroPoolSupportsNullifier =
    buildArch.isPhysicalRightClicker &&
    (META_NULLIFIER_CARRIER_HERO_IDS.has(Number(player.hero_id)) || metaProfile.topMetaItemIds.includes(225) || arch === "CARRY_STRIKER");

  // Профильный контроль/дебафф для кастеров (MID_SPELLCASTER: Invoker, Storm, Puck, Zeus и др.): Hex (#96), Orchid (#98), Bloodthorn (#250), Shiva (#119)
  const casterControlIds = [96, 250, 98, 119];
  const hasCasterProfileCounter = hasAnyItem(casterControlIds);
  const ownedCasterCounterNames = casterControlIds
    .filter(id => hasItem(id))
    .map(id => (ITEMS_DB[id] && ITEMS_DB[id].name) || `Item #${id}`);

  const enemyControlHeroes = [];
  const enemyAoEControlHeroes = [];
  const enemySingleTargetHeroes = [];
  const enemyCheapLinkenPoppers = [];

  const enemyEulsHolders = [];
  const enemyDefensiveEulsHolders = [];
  const enemyGhostHolders = [];
  const enemyGlimmerHolders = [];
  const enemyForceHolders = [];
  const enemyAeonHolders = [];
  const enemyLateSavePurchases = [];
  const enemyInnatePurgeSaves = [];

  const enemyCriticalPassives = [];
  const enemySecondaryPassives = [];
  const enemySustainHeroes = [];
  const enemySustainItems = [];
  const enemyIllusionSwarm = [];
  const enemyMagicBurst = [];

  const findEnemyItemTimeSec = (ep, targetItemIds) => {
    const pLog = Array.isArray(ep.purchase_log) ? ep.purchase_log : [];
    if (pLog.length === 0) return null;
    for (const id of targetItemIds) {
      const meta = ITEMS_DB[id];
      const entry = findItemPurchaseEntry(id, meta, pLog);
      if (entry && typeof entry.time === "number") return entry.time;
    }
    return null;
  };

  const isBoughtRightBeforeMatchEnd = (tSec) => typeof tSec === "number" && durationSec > 600 && (durationSec - tSec < 300);

  for (const ep of (enemyPlayers || [])) {
    const hId = Number(ep.hero_id);
    const hName = (HEROES_DB[hId] && HEROES_DB[hId].name) || ep.hero_name || `Hero #${hId}`;
    const epItems = getPlayerAllItemIds(ep);
    const epHas = (id) => epItems.includes(id);

    if (HEAVY_DISABLE_HERO_IDS.has(hId)) enemyControlHeroes.push(hName);
    else if (hId === 62) enemyControlHeroes.push("Bounty Hunter (Track)");
    if (AOE_OR_GROUND_CONTROL_HERO_IDS.has(hId)) enemyAoEControlHeroes.push(hName);
    if (HIGH_VALUE_LINKEN_TARGET_HERO_IDS.has(hId) || epHas(96)) {
      enemySingleTargetHeroes.push(epHas(96) && !HIGH_VALUE_LINKEN_TARGET_HERO_IDS.has(hId) ? `${hName} (Hex)` : hName);
    }
    if (CHEAP_LINKEN_POPPER_HERO_IDS.has(hId)) enemyCheapLinkenPoppers.push(hName);

    if (epHas(100) || epHas(610)) {
      const itemName = epHas(610) ? "Wind Waker" : "Eul's Scepter";
      const tSec = findEnemyItemTimeSec(ep, [610, 100]);
      const obj = { heroId: hId, heroName: hName, itemName, timeSec: tSec, label: `${hName} (${itemName}${tSec ? ` ${formatClock(tSec)}` : ""})` };
      if (isBoughtRightBeforeMatchEnd(tSec)) {
        enemyLateSavePurchases.push(obj.label);
      } else {
        enemyEulsHolders.push(obj);
        if (epHas(610) || !OFFENSIVE_EULS_INITIATOR_HERO_IDS.has(hId)) {
          enemyDefensiveEulsHolders.push(obj);
        }
      }
    }
    if (epHas(37) || epHas(176)) {
      const itemName = epHas(176) ? "Ethereal Blade" : "Ghost Scepter";
      const tSec = findEnemyItemTimeSec(ep, [176, 37]);
      const obj = { heroName: hName, itemName, timeSec: tSec, label: `${hName} (${itemName}${tSec ? ` ${formatClock(tSec)}` : ""})` };
      if (isBoughtRightBeforeMatchEnd(tSec)) {
        enemyLateSavePurchases.push(obj.label);
      } else {
        enemyGhostHolders.push(obj);
      }
    }
    if (epHas(254)) {
      const tSec = findEnemyItemTimeSec(ep, [254]);
      const lbl = `${hName} (Glimmer Cape${tSec ? ` ${formatClock(tSec)}` : ""})`;
      if (isBoughtRightBeforeMatchEnd(tSec)) {
        enemyLateSavePurchases.push(lbl);
      } else {
        enemyGlimmerHolders.push({ heroName: hName, itemName: "Glimmer Cape", timeSec: tSec, label: lbl });
      }
    }
    if (epHas(102) || epHas(263)) {
      const itemName = epHas(263) ? "Hurricane Pike" : "Force Staff";
      const tSec = findEnemyItemTimeSec(ep, [263, 102]);
      const lbl = `${hName} (${itemName}${tSec ? ` ${formatClock(tSec)}` : ""})`;
      if (isBoughtRightBeforeMatchEnd(tSec)) {
        enemyLateSavePurchases.push(lbl);
      } else {
        enemyForceHolders.push({ heroName: hName, itemName, timeSec: tSec, label: lbl });
      }
    }
    if (epHas(256)) {
      const tSec = findEnemyItemTimeSec(ep, [256]);
      const lbl = `${hName} (Aeon Disk${tSec ? ` ${formatClock(tSec)}` : ""})`;
      if (isBoughtRightBeforeMatchEnd(tSec)) {
        enemyLateSavePurchases.push(lbl);
      } else {
        enemyAeonHolders.push({ heroName: hName, itemName: "Aeon Disk", timeSec: tSec, label: lbl });
      }
    }
    if (PURGEABLE_INNATE_SAVE_HEROES[hId]) {
      enemyInnatePurgeSaves.push(PURGEABLE_INNATE_SAVE_HEROES[hId]);
    }

    if (CRITICAL_PASSIVE_BOSS_HEROES[hId]) enemyCriticalPassives.push(CRITICAL_PASSIVE_BOSS_HEROES[hId]);
    else if (SECONDARY_PASSIVE_HEROES[hId]) enemySecondaryPassives.push(SECONDARY_PASSIVE_HEROES[hId]);

    if (HEAVY_SUSTAIN_HEROES[hId]) enemySustainHeroes.push(HEAVY_SUSTAIN_HEROES[hId]);
    if (epHas(156) || epHas(114) || epHas(121)) {
      const sItem = epHas(156) ? "Satanic" : epHas(114) ? "Heart of Tarrasque" : "Bloodstone";
      enemySustainItems.push(`${hName} (${sItem})`);
    }

    if (ILLUSION_OR_SWARM_HEROES[hId]) enemyIllusionSwarm.push(ILLUSION_OR_SWARM_HEROES[hId]);
    if (HEAVY_MAGIC_BURST_HERO_IDS.has(hId)) enemyMagicBurst.push(hName);
  }

  const targetThreatReport = analyzeEnemyTargetThreats({
    player,
    roleInfo,
    buildArch,
    allPlayerItems,
    purchaseLog,
    enemyPlayers,
    durationSec,
    findEnemyItemTimeSec,
    isBoughtRightBeforeMatchEnd
  });

  const enemyControlNamesStr = enemyControlHeroes.slice(0, 5).join(", ");
  const needsBkbToHit =
    (arch === "CARRY_STRIKER" || arch === "MID_RIGHTCLICKER" || arch === "OFFLANE_DUELIST") &&
    !isInnateImmuneOrElusive &&
    (BKB_DEPENDENT_STRIKER_HERO_IDS.has(player.hero_id) || metaProfile.bkbIsPopular);

  const hasBkbInInventory = hasItem(116);
  const hasLinkensInInventory = hasItem(123);

  const bkbEntry = Array.isArray(purchaseLog) ? purchaseLog.find(p => p && p.key === "black_king_bar") : null;
  const bkbBoughtAtSec = bkbEntry ? bkbEntry.time : null;
  const bkbBoughtAtStr = bkbBoughtAtSec !== null ? formatClock(bkbBoughtAtSec) : null;
  const bkbBoughtAtMin = bkbBoughtAtSec !== null ? Math.round(bkbBoughtAtSec / 60) : null;

  const llmPayload = buildLlmAuditPayload(
    player,
    roleInfo,
    invAudit,
    enemyPlayers,
    metaProfile,
    durationMin,
    netWorth,
    wonMatch,
    targetThreatReport
  );

  let hasCriticalBuildMistake = false;
  let buildVerdictStatus = "good";
  let buildScore = 94;
  const criticalHeadlines = [];
  const criticalExplanations = [];
  const warningHeadlines = [];
  const warningExplanations = [];
  const positiveNotes = [];
  const counterMatrix = [];
  const buildFindings = [];
  const itemTimelinePills = [];

  const getItemsBoughtAfterSec = (afterSec, excludeItemIds = []) => {
    if (!afterSec || !Array.isArray(purchaseLog) || purchaseLog.length === 0) return [];
    const list = [];
    for (const entry of purchaseLog) {
      if (!entry || typeof entry.time !== "number" || entry.time <= afterSec + 20) continue;
      const matchedItem = richItems.find(ri => ri.slug === entry.key && !excludeItemIds.includes(ri.id) && ri.major);
      if (matchedItem) {
        const lbl = `${matchedItem.name} (${formatClock(entry.time)})`;
        if (!list.includes(lbl)) list.push(lbl);
      } else if (GREEDY_DAMAGE_ITEM_KEYS[entry.key]) {
        const lbl = `${GREEDY_DAMAGE_ITEM_KEYS[entry.key]} (${formatClock(entry.time)})`;
        if (!list.includes(lbl)) list.push(lbl);
      }
    }
    return list.slice(0, 3);
  };

  // =========================================================================
  // ПРОВЕРКА 0: ДЕТЕКТОР АБСУРДНОГО ЗАКУПА / ТРОЛЛИНГА СБОРКОЙ НА КОРАХ (Pos 1–3)
  // =========================================================================
  if (invAudit.isTrollOrAbsurdBuild && invAudit.trollBuildReason) {
    hasCriticalBuildMistake = true;
    buildVerdictStatus = "empty_networth";
    buildScore = 18;
    const trollHeadline = `Руин / троллинг сборкой на ${roleInfo.heroName}: ${invAudit.trollBuildReason}!`;
    criticalHeadlines.push(trollHeadline);
    criticalExplanations.push(`На кор-позиции «${roleInfo.roleLabel}» вместо боевых слотов собрал нерабочий инвентарь (${invAudit.trollBuildReason}).`);

    counterMatrix.push({
      status: "failed",
      category: "Целостность сборки (Кор-слоты)",
      threat: `Реализация ${netWorth.toLocaleString("ru-RU")} 🪙 нетворса`,
      expectedItems: metaProfile.topMetaItemNames.slice(0, 4).join(", "),
      playerResponse: `✕ Руин сборкой: ${invAudit.trollBuildReason}`
    });

    buildFindings.push({
      categoryKey: "economy",
      maxCap: 35,
      points: 28,
      badge: "Троллинг сборкой",
      reason: {
        type: "sabotage",
        category: "Пустой нетворс",
        timestamp: "Инвентарь",
        title: trollHeadline,
        shortPill: "Мусор / дубликаты в слотах при высоком NW",
        detail: invAudit.trollBuildReason
      }
    });
  }

  // =========================================================================
  // ПРОВЕРКА 1 МАТРИЦЫ: АНТИ-УКЛОНЕНИЕ (MKB для физ-коров vs Hex/Orchid/Shiva для кастеров)
  // =========================================================================
  if (targetThreatReport.hasAnyEvasionOnMap) {
    const evasionSummaryStr = targetThreatReport.allDetectedEvasionLabels.slice(0, 3).join(", ");
    const unresolvedSummaryStr = targetThreatReport.unresolvedLabels.slice(0, 3).join(", ") || evasionSummaryStr;

    const hasDirectTrueStrike = arch === "MID_RIGHTCLICKER"
      ? hasAnyItem([135, 250, 911, 96])
      : hasAnyItem([135, 250, 911]);

    if (arch === "MID_SPELLCASTER") {
      // С кастеров (Invoker, Storm, Puck, Zeus и др.) ЗАПРЕЩЕНО требовать MKB! Проверяем их профильный контроль/дебафф (Hex / Orchid / Bloodthorn / Shiva)
      if (hasCasterProfileCounter) {
        const cNames = ownedCasterCounterNames.slice(0, 2).join(", ");
        positiveNotes.push(`На кастере ${roleInfo.heroName} собрал профильный контроль/дебафф (${cNames}) против ${evasionSummaryStr}.`);
        counterMatrix.push({
          status: "passed",
          category: "Контроль кастера против уклонения",
          threat: `Уклонение / Мобильность: ${evasionSummaryStr}`,
          expectedItems: "Scythe of Vyse (Hex) / Orchid / Shiva's Guard",
          playerResponse: `✓ Собрано по мете мага: ${cNames} (MKB кастеру не нужен)`
        });
      } else {
        counterMatrix.push({
          status: "passed",
          category: "Анти-уклонение (По роли кастера)",
          threat: `Уклонение / Миссы: ${evasionSummaryStr}`,
          expectedItems: "Урон со способностей / Hex / Shiva (MKB не требуется)",
          playerResponse: `✓ ЗАКРЫТО ПО РОЛИ: ${roleInfo.heroName} играет через маг-прокаст (покупка MKB — задача физ-керри)`
        });
      }
    } else if (!heroPoolSupportsMkb) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-уклонение (MKB)",
        threat: `Уклонение / Миссы: ${evasionSummaryStr}`,
        expectedItems: "По роли не требуется",
        playerResponse: "✓ ЗАКРЫТО ПО РОЛИ: Урон со способностей / контроль (покупка MKB — задача райткликера)"
      });
    } else if (hasDirectTrueStrike) {
      const ansId = [135, 250, 911, 96].find(id => hasItem(id)) || 135;
      const ansName = (ITEMS_DB[ansId] && ITEMS_DB[ansId].name) || "Monkey King Bar";
      const ansEntry = findItemPurchaseEntry(ansId, ITEMS_DB[ansId], purchaseLog);
      const ansTimeStr = ansEntry && typeof ansEntry.time === "number" ? ` на ${formatClock(ansEntry.time)}` : "";
      positiveNotes.push(`Собрал ${ansName}${ansTimeStr} против уклонения врага (${evasionSummaryStr}).`);
      counterMatrix.push({
        status: "passed",
        category: "Анти-уклонение (MKB)",
        threat: `Уклонение / Миссы: ${evasionSummaryStr}`,
        expectedItems: arch === "MID_RIGHTCLICKER" ? "MKB / Bloodthorn / Hex" : "Monkey King Bar / Bloodthorn",
        playerResponse: `✓ Купил ${ansName}${ansTimeStr} (пробивает уклонение)`
      });
    } else if (!targetThreatReport.mkbStrictlyRequired) {
      const smartReasonText = targetThreatReport.resolvedNotes.length > 0
        ? targetThreatReport.resolvedNotes[0]
        : `Низкий вес миссов (${evasionSummaryStr}) — тратить 4700 🪙 и слот на MKB нецелесообразно (Slot Efficiency)`;

      positiveNotes.push(`Грамотный менеджмент слотов: не стал тратить слот на MKB (${smartReasonText}).`);
      counterMatrix.push({
        status: "passed",
        category: "Анти-уклонение и ценность слота",
        threat: `Второстепенные миссы: ${evasionSummaryStr}`,
        expectedItems: "MKB НЕ требуется (закрыто Nullifier / диспелом / АС)",
        playerResponse: `✓ ГРАМОТНЫЙ ОТКАЗ ОТ MKB: ${smartReasonText}`
      });
    } else if (wonMatch) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-уклонение (MKB)",
        threat: `Уклонение врага: ${unresolvedSummaryStr}`,
        expectedItems: "Monkey King Bar / Bloodthorn",
        playerResponse: "✓ ЗАКРЫТО ПО ИГРЕ: Победа и высокий ДПС без покупки MKB"
      });
    } else if (!wonMatch && targetThreatReport.mkbStrictlyRequired && (durationMin >= 23 || netWorth >= 13500)) {
      const bflyHeroNames = targetThreatReport.activeButterflyHolders.map(x => x.heroName).join(", ");
      const earliestBflySec = Math.min(
        ...(targetThreatReport.activeButterflyHolders.map(x => x.timeSec).filter(Boolean).concat([99999]))
      );
      const boughtAfterBfly = earliestBflySec < 99999 ? getItemsBoughtAfterSec(earliestBflySec, [135, 250]) : [];
      const boughtAfterBflyText = boughtAfterBfly.length > 0
        ? ` (после покупки врагом Butterfly взял ${boughtAfterBfly.join(" → ")} вместо MKB)`
        : "";

      const mkbHeadline = targetThreatReport.activeButterflyHolders.length >= 1
        ? `Не купил MKB на ${roleInfo.heroName} против Butterfly у ${bflyHeroNames}!`
        : `Не купил MKB на ${roleInfo.heroName} против тяжелого уклонения (${unresolvedSummaryStr})!`;
      const mkbDetail = targetThreatReport.activeButterflyHolders.length >= 1
        ? `У вражеского кора ${targetThreatReport.activeButterflyHolders.map(x => x.label).join(", ")} собрана Butterfly (35% уклонения), но ${roleInfo.heroName} (${buildArch.archetypeLabel}) при нетворсе ${netWorth.toLocaleString("ru-RU")} 🪙 не купил Monkey King Bar${boughtAfterBflyText}, теряя более трети ДПС с руки!`
        : `Против тяжелого уклонения (${unresolvedSummaryStr}) райткликеру ${roleInfo.heroName} критически нужен Monkey King Bar (или Bloodthorn) для True Strike, но за ${Math.round(durationMin)} мин слот не был собран.`;

      hasCriticalBuildMistake = true;
      buildVerdictStatus = "hidden_ruin";
      buildScore -= 28;
      criticalHeadlines.push(mkbHeadline);
      criticalExplanations.push(mkbDetail);

      counterMatrix.push({
        status: "failed",
        category: "Анти-уклонение (MKB)",
        threat: `Тяжелое уклонение: ${unresolvedSummaryStr}`,
        expectedItems: arch === "MID_RIGHTCLICKER" ? "MKB / Bloodthorn / Hex" : "Monkey King Bar (MKB)",
        playerResponse: `✕ Нет MKB / Bloodthorn (промахи с руки по ${bflyHeroNames || unresolvedSummaryStr})`
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: targetThreatReport.activeButterflyHolders.length >= 1 ? 22 : 18,
        badge: targetThreatReport.activeButterflyHolders.length >= 1 ? `Без MKB против Butterfly (${bflyHeroNames})` : "Без MKB против уклонения",
        reason: {
          type: "ballast",
          category: "Оценщик билда (ИИ)",
          timestamp: "Контр-закуп",
          title: mkbHeadline,
          shortPill: targetThreatReport.activeButterflyHolders.length >= 1 ? `0 MKB против Butterfly (${bflyHeroNames})` : `0 MKB против ${unresolvedSummaryStr}`,
          detail: mkbDetail
        }
      });
    }
  }

  // =========================================================================
  // ПРОВЕРКА 2 МАТРИЦЫ: АНТИ-СЕЙВ (Nullifier для физ-керри Pos 1 vs Hex/Orchid/Shiva для кастеров)
  // =========================================================================
  const realDefensiveSaves = [
    ...enemyDefensiveEulsHolders.map(x => x.label),
    ...enemyGhostHolders.map(x => x.label),
    ...enemyAeonHolders.map(x => x.label),
    ...enemyGlimmerHolders.map(x => x.label),
    ...enemyForceHolders.map(x => x.label),
    ...enemyInnatePurgeSaves
  ];
  const isJuggernaut = Number(player.hero_id) === 8;
  const relevantSavesForHero = isJuggernaut
    ? [
        ...enemyEulsHolders.map(x => x.label),
        ...enemyGhostHolders.map(x => x.label),
        ...enemyAeonHolders.map(x => x.label),
        ...enemyGlimmerHolders.map(x => x.label),
        ...enemyForceHolders.map(x => x.label),
        ...enemyInnatePurgeSaves
      ]
    : realDefensiveSaves;

  const purgeableSavesCount = isJuggernaut
    ? (enemyEulsHolders.length + enemyGhostHolders.length + enemyAeonHolders.length + enemyGlimmerHolders.length + enemyInnatePurgeSaves.length)
    : (enemyDefensiveEulsHolders.length + enemyGhostHolders.length + enemyAeonHolders.length + enemyGlimmerHolders.length + enemyInnatePurgeSaves.length);

  const totalKiteAndSaveCount = purgeableSavesCount + enemyForceHolders.length;

  const hasNullifierThreat =
    purgeableSavesCount >= 2 ||
    (purgeableSavesCount >= 1 && enemyForceHolders.length >= 1) ||
    enemyInnatePurgeSaves.length >= 1;

  const hasNullifier = hasItem(225);
  const hasAlternativeLockdown = hasAnyItem([96, 250, 98, 208]);
  const hasEnemyInnateGhost = enemyInnatePurgeSaves.some(s => s.includes("Necrophos") || s.includes("Pugna") || s.includes("Omniknight"));

  if (hasNullifierThreat || (enemyEulsHolders.length >= 2 && !heroPoolSupportsNullifier)) {
    const saveSummaryStr = (relevantSavesForHero.length > 0 ? relevantSavesForHero : enemyEulsHolders.map(x => x.label)).slice(0, 4).join(", ");
    const eulsCount = isJuggernaut ? enemyEulsHolders.length : enemyDefensiveEulsHolders.length;
    const eulsWord = eulsCount >= 2 ? `${eulsCount} Eul's Scepter` : `${relevantSavesForHero.length} сейв-слотов`;

    if (arch === "MID_SPELLCASTER") {
      // Кастерам (Invoker, Storm, Puck, Zeus и др.) ЗАПРЕЩЕНО выдавать штраф за отсутствие Nullifier!
      // Вместо этого проверяем наличие Scythe of Vyse (Hex), Orchid / Bloodthorn или Shiva's Guard:
      if (hasCasterProfileCounter) {
        const cNames = ownedCasterCounterNames.slice(0, 2).join(", ");
        positiveNotes.push(`Против сейвов врага (${saveSummaryStr}) на кастере ${roleInfo.heroName} собран профильный слот: ${cNames}.`);
        counterMatrix.push({
          status: "passed",
          category: "Контроль кастера против сейвов",
          threat: `Сейвы врага: ${saveSummaryStr}`,
          expectedItems: "Scythe of Vyse (Hex) / Orchid / Bloodthorn / Shiva's Guard",
          playerResponse: `✓ Собрано по мете кастера: ${cNames} (Nullifier магу не нужен)`
        });
      } else if (!wonMatch && durationMin >= 30 && netWorth >= 15500) {
        if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
        buildScore -= 10;
        const casterWarn = `На кастере ${roleInfo.heroName} не хватает Hex / Orchid / Shiva's Guard против сейвов (${saveSummaryStr})`;
        warningHeadlines.push(casterWarn);
        warningExplanations.push(`Против множества сейвов врага (${saveSummaryStr}) магу-кастеру ${roleInfo.heroName} рекомендуется добирать Scythe of Vyse (Hex), Orchid/Bloodthorn или Shiva's Guard.`);
        counterMatrix.push({
          status: "warning",
          category: "Контроль кастера против сейвов",
          threat: `Сейвы врага: ${saveSummaryStr}`,
          expectedItems: "Scythe of Vyse (Hex) / Orchid / Shiva's Guard",
          playerResponse: "⚠ Нет профильного Hex / Orchid / Shiva (Nullifier магу не требуется)"
        });
      } else {
        counterMatrix.push({
          status: "passed",
          category: "Анти-сейв (По роли кастера)",
          threat: `Сейвы врага: ${saveSummaryStr}`,
          expectedItems: "Hex / Orchid / Shiva (Nullifier не входит в пул мага)",
          playerResponse: "✓ ЗАКРЫТО ПО РОЛИ КАСТЕРА (покупка Nullifier — задача физ-керри Pos 1)"
        });
      }
    } else if (hasNullifier) {
      const nullEntry = findItemPurchaseEntry(225, ITEMS_DB[225], purchaseLog);
      const nullTimeStr = nullEntry && typeof nullEntry.time === "number" ? ` на ${formatClock(nullEntry.time)}` : "";
      positiveNotes.push(`Грамотно собрал Nullifier${nullTimeStr} против сейвов врага (${saveSummaryStr}).`);
      counterMatrix.push({
        status: "passed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "Nullifier",
        playerResponse: `✓ Купил Nullifier${nullTimeStr} (снимает Ghost Shroud / ветра / гост / глиммер)`
      });
    } else if (teamHasNullifier) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "Nullifier (в команде)",
        playerResponse: "✓ ЗАКРЫТО КОМАНДОЙ (Nullifier / Demonic Purge уже есть у союзников)"
      });
    } else if (!heroPoolSupportsNullifier) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "По роли не требуется",
        playerResponse: "✓ ЗАКРЫТО ПО РОЛИ (покупка Nullifier — задача профильного физ-керри)"
      });
    } else if (hasAlternativeLockdown && !hasEnemyInnateGhost && arch !== "CARRY_STRIKER") {
      counterMatrix.push({
        status: "passed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "Hex / Abyssal / Bloodthorn / Nullifier",
        playerResponse: "✓ ЗАКРЫТО КОНТРОЛЕМ: Убивал цели за время Hex / Abyssal / сайленса до нажатия сейва"
      });
    } else if (wonMatch) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "Nullifier (ситуативно)",
        playerResponse: "✓ ЗАКРЫТО ПО ИГРЕ: Победа и реализация урона без необходимости в Nullifier"
      });
    } else if (
      !wonMatch &&
      heroPoolSupportsNullifier &&
      purgeableSavesCount >= 1 &&
      totalKiteAndSaveCount >= 2 &&
      netWorth >= 14500 &&
      durationMin >= 27
    ) {
      // ИСПРАВЛЕНО (Кейс Clinkz Pos 1): Если профильный физ-керри (Clinkz, PA, Juggernaut, Slark, Ursa и др.) проиграл игру
      // и не купил Nullifier против сейвов врага (Eul's, Ghost, Glimmer, Force Staff) — всегда выдаем Red Trigger!
      const headlineMsg = eulsCount >= 2
        ? `Не купил Nullifier на ${roleInfo.heroName} против ${eulsWord} у врагов!`
        : `Не купил Nullifier на ${roleInfo.heroName} против сейвов врага (${saveSummaryStr})!`;
      const detailMsg = isJuggernaut
        ? `У врагов собраны сейвы (${saveSummaryStr}), которые сбрасывают Omnislash и физический фокус Juggernaut, но при нетворсе ${netWorth.toLocaleString("ru-RU")} 🪙 к ${Math.round(durationMin)}-й минуте игрок так и не купил Nullifier.`
        : `На профильном физ-коре ${roleInfo.heroName} (${buildArch.archetypeLabel}) при нетворсе ${netWorth.toLocaleString("ru-RU")} 🪙 за ${Math.round(durationMin)} мин не собран Nullifier против защитных сейвов врага (${saveSummaryStr}), из-за чего цели переживали фокус в драках!`;

      hasCriticalBuildMistake = true;
      buildVerdictStatus = "hidden_ruin";
      buildScore -= 26;
      criticalHeadlines.push(headlineMsg);
      criticalExplanations.push(detailMsg);

      counterMatrix.push({
        status: "failed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "Nullifier (обязателен по мете героя против сейвов)",
        playerResponse: `✕ Не купил Nullifier (враги кайтят и уходят в сейвах)`
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: arch === "CARRY_STRIKER" || isJuggernaut || eulsCount >= 2 ? 22 : 18,
        badge: eulsCount >= 2 ? `Без Nullifier в ${eulsCount} Еула` : "Без Nullifier в сейвы",
        reason: {
          type: "ballast",
          category: "Оценщик билда (ИИ)",
          timestamp: "Лейт-закуп",
          title: headlineMsg,
          shortPill: `0 Nullifier против ${eulsWord}`,
          detail: detailMsg
        }
      });
    } else if (hasNullifierThreat) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-сейв (Nullifier)",
        threat: `Сейвы врага: ${saveSummaryStr}`,
        expectedItems: "Nullifier (при NW >= 14.5k и 27+ мин)",
        playerResponse: `✓ ЗАКРЫТО: Игра завершилась до выхода в слот Nullifier (NW ${netWorth.toLocaleString("ru-RU")} 🪙)`
      });
    }
  } else if (enemyLateSavePurchases.length >= 1) {
    counterMatrix.push({
      status: "passed",
      category: "Анти-сейв (Nullifier)",
      threat: `Поздний сейв врага перед концом игры: ${enemyLateSavePurchases.join(", ")}`,
      expectedItems: "Nullifier не требуется",
      playerResponse: "✓ ЗАКРЫТО: Сейв куплен врагом перед самым падением трона (< 5 мин до конца)"
    });
  } else if (enemyEulsHolders.length >= 1) {
    counterMatrix.push({
      status: "passed",
      category: "Анти-сейв (Nullifier)",
      threat: `Ветра инициаторов: ${enemyEulsHolders.map(x => x.label).join(", ")}`,
      expectedItems: "BKB / Linken's / Lotus (Nullifier не нужен)",
      playerResponse: "✓ ЗАКРЫТО: Вражеские Eul's атакующие — защитный Nullifier не требуется"
    });
  }

  // =========================================================================
  // ПРОВЕРКА 3 МАТРИЦЫ: АНТИ-ХИЛ (Vessel / Skadi / Shiva для кастеров)
  // =========================================================================
  const allSustainThreats = [...enemySustainHeroes, ...enemySustainItems];
  const hasHeavySustainThreat =
    enemySustainItems.length >= 1 ||
    enemySustainHeroes.some(h => ["Huskar", "Alchemist", "Morphling", "Necrophos", "Io", "Bristleback", "Timbersaw", "Centaur Warrunner"].includes(h)) ||
    enemySustainHeroes.length >= 2;

  const playerHasAntiHeal = hasAnyItem([267, 160, 569, 119]);
  const sustainClosedByNullifierBurst =
    hasNullifier &&
    enemySustainHeroes.length === 1 &&
    enemySustainHeroes[0] === "Necrophos" &&
    enemySustainItems.length === 0;

  if (hasHeavySustainThreat) {
    const sustainStr = allSustainThreats.slice(0, 3).join(", ");
    const expectedAntiHealItem = (arch === "CARRY_STRIKER" || arch === "MID_RIGHTCLICKER")
      ? "Eye of Skadi"
      : arch === "MID_SPELLCASTER"
        ? "Shiva's Guard / Spirit Vessel"
        : "Spirit Vessel";

    if (playerHasAntiHeal) {
      const ahName = hasItem(160) ? "Eye of Skadi" : hasItem(267) ? "Spirit Vessel" : hasItem(119) ? "Shiva's Guard" : "Orb of Corrosion";
      positiveNotes.push(`Собрал анти-хил (${ahName}) против регена/вампиризма врага (${sustainStr}).`);
      counterMatrix.push({
        status: "passed",
        category: "Анти-хил (Vessel / Skadi / Shiva)",
        threat: `Хил / Вампиризм: ${sustainStr}`,
        expectedItems: expectedAntiHealItem,
        playerResponse: `✓ Купил ${ahName} (режет хил и реген врага)`
      });
    } else if (sustainClosedByNullifierBurst) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-хил и берст (Nullifier)",
        threat: `Хил в Ghost Shroud: ${sustainStr}`,
        expectedItems: "Nullifier / Eye of Skadi / Spirit Vessel",
        playerResponse: "✓ ЗАКРЫТО СЛОТОМ NULLIFIER: Снимает Ghost Shroud с Некрофоса, лишая его усиленного отхила"
      });
    } else if (teamHasAntiHeal || teamHasAnyItem([119])) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-хил (Vessel / Skadi / Shiva)",
        threat: `Хил / Вампиризм: ${sustainStr}`,
        expectedItems: `${expectedAntiHealItem} (командный)`,
        playerResponse: "✓ ЗАКРЫТО КОМАНДОЙ (в команде уже есть Spirit Vessel / Skadi / Shiva)"
      });
    } else if (durationMin >= 26 && !wonMatch && !isDominatingKillerCore && !isHighImpactWinnerOrCarry) {
      const ahHeadline = `В команде нет анти-хила (${expectedAntiHealItem}) против ${sustainStr}`;
      const ahDetail = `Против мощного сустейна/регена врага (${sustainStr}) вся команда осталась без анти-хила (на роли «${buildArch.archetypeLabel}» рекомендуется ${expectedAntiHealItem}).`;

      if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
      buildScore -= 9;
      warningHeadlines.push(ahHeadline);
      warningExplanations.push(ahDetail);

      counterMatrix.push({
        status: "warning",
        category: "Анти-хил (Vessel / Skadi)",
        threat: `Хил / Вампиризм: ${sustainStr}`,
        expectedItems: expectedAntiHealItem,
        playerResponse: `⚠ В команде 0 анти-хила (рекомендуется ${expectedAntiHealItem})`
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: 9,
        badge: "Без анти-хила (Vessel/Skadi)",
        reason: {
          type: "ballast",
          category: "Оценщик билда (ИИ)",
          timestamp: "Командный контр-закуп",
          title: ahHeadline,
          shortPill: `0 Vessel/Skadi против ${sustainStr}`,
          detail: ahDetail
        }
      });
    } else {
      counterMatrix.push({
        status: "passed",
        category: "Анти-хил (Vessel / Skadi)",
        threat: `Хил / Вампиризм: ${sustainStr}`,
        expectedItems: expectedAntiHealItem,
        playerResponse: `✓ ЗАКРЫТО ПО ИГРЕ (${kills} фрагов / перебили сустейн фокусом)`
      });
    }
  }

  // =========================================================================
  // ПРОВЕРКА 4 МАТРИЦЫ: ОТКЛЮЧЕНИЕ ПАССИВОК / BREAK (Silver Edge)
  // =========================================================================
  const allPassiveThreats = [...enemyCriticalPassives, ...enemySecondaryPassives];
  const hasPassiveBoss = enemyCriticalPassives.length >= 1;
  const hasSilverEdge = hasItem(249);
  const hasUnupgradedShadowBlade = hasItem(152) && !hasSilverEdge;
  const requiresBreakByArchetype =
    (arch === "CARRY_STRIKER" || arch === "MID_RIGHTCLICKER" || arch === "OFFLANE_DUELIST") &&
    (SILVER_EDGE_CARRIER_HERO_IDS.has(player.hero_id) || hasUnupgradedShadowBlade);

  if (hasPassiveBoss) {
    const passiveStr = allPassiveThreats.slice(0, 3).join(", ");
    if (hasSilverEdge) {
      positiveNotes.push(`Собрал Silver Edge (Break) против пассивок врага (${passiveStr}).`);
      counterMatrix.push({
        status: "passed",
        category: "Отключение пассивок (Break)",
        threat: `Пассивки врага: ${passiveStr}`,
        expectedItems: "Silver Edge (Break)",
        playerResponse: "✓ Купил Silver Edge (отключает пассивки)"
      });
    } else if (teamHasBreak) {
      counterMatrix.push({
        status: "passed",
        category: "Отключение пассивок (Break)",
        threat: `Пассивки врага: ${passiveStr}`,
        expectedItems: "Silver Edge / Break (в команде)",
        playerResponse: "✓ ЗАКРЫТО КОМАНДОЙ (источник Break уже есть у союзников)"
      });
    } else if (!requiresBreakByArchetype) {
      counterMatrix.push({
        status: "passed",
        category: "Отключение пассивок (Break)",
        threat: `Пассивки врага: ${passiveStr}`,
        expectedItems: "По роли не требуется",
        playerResponse: `✓ ЗАКРЫТО ПО РОЛИ (${roleInfo.heroName} играет через свои тайминги / способности)`
      });
    } else if (wonMatch) {
      counterMatrix.push({
        status: "passed",
        category: "Отключение пассивок (Break)",
        threat: `Пассивки врага: ${passiveStr}`,
        expectedItems: "Silver Edge (ситуативно)",
        playerResponse: "✓ ЗАКРЫТО ПО ИГРЕ: Победа и реализация урона без необходимости в Break"
      });
    } else if (durationMin >= 28 && netWorth >= 16000 && !wonMatch && !isDominatingKillerCore) {
      const breakHeadline = hasUnupgradedShadowBlade
        ? `Не апгрейднул Shadow Blade в Silver Edge (Break) против ${passiveStr}!`
        : `В команде нет Break (Silver Edge) против ${passiveStr}`;
      const breakDetail = `Против плотных пассивок (${passiveStr}) у команды 0 источников Break. На ${roleInfo.heroName} можно было собрать Silver Edge для отключения пассивки.`;

      if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
      buildScore -= 12;
      warningHeadlines.push(breakHeadline);
      warningExplanations.push(breakDetail);

      counterMatrix.push({
        status: "warning",
        category: "Отключение пассивок (Break)",
        threat: `Пассивки врага: ${passiveStr}`,
        expectedItems: "Silver Edge (Break)",
        playerResponse: hasUnupgradedShadowBlade ? "⚠ Оставил Shadow Blade без апа в Silver Edge" : "⚠ Нет источника Break в команде"
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: 12,
        badge: "Без Break (Silver Edge)",
        reason: {
          type: "ballast",
          category: "Оценщик билда (ИИ)",
          timestamp: "Контр-закуп",
          title: breakHeadline,
          shortPill: `0 Break против ${passiveStr}`,
          detail: breakDetail
        }
      });
    }
  }

  // =========================================================================
  // ПРОВЕРКА 5 МАТРИЦЫ: ЗАЩИТА ОТ КОНТРОЛЯ (BKB / Линка / Инициация + Сейв Позиции 3)
  // =========================================================================
  const hasInitiationSlot = hasAnyItem([1, 600, 603, 604, 939, 152, 249]);
  const hasTankDefensiveOrTeamSlot = hasAnyItem([116, 90, 242, 226, 127, 119, 108, 692, 114, 231, 931]);

  if (arch === "OFFLANE_TANK_INITIATOR") {
    if (hasInitiationSlot && hasTankDefensiveOrTeamSlot) {
      const initName = hasAnyItem([1, 600, 603, 604]) ? "Blink Dagger" : hasItem(939) ? "Harpoon" : "Shadow Blade / Silver Edge";
      const defNames = richItems
        .filter(i => [116, 90, 242, 226, 127, 119, 108, 692, 114, 231, 931].includes(i.id))
        .map(i => i.name)
        .slice(0, 3)
        .join(", ");
      positiveNotes.push(`Эталонная сборка танка-инициатора на ${roleInfo.heroName}: ${initName} + ${defNames}.`);
      counterMatrix.push({
        status: "passed",
        category: "Инициация и Фронтлейн (Pos 3)",
        threat: `Контроль и фокус врага (${enemyControlNamesStr || "командные драки"})`,
        expectedItems: "Blink / Harpoon + BKB / Pipe / Lotus / Blade Mail / Shiva",
        playerResponse: `✓ Собрал ${initName} + ${defNames}`
      });
    } else if (durationMin >= 25 && !hasInitiationSlot && !hasTankDefensiveOrTeamSlot && !wonMatch) {
      if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
      buildScore -= 18;
      const tankWarn = `Танк-инициатор ${roleInfo.heroName} без слотов инициации и командного сейва`;
      warningHeadlines.push(tankWarn);
      warningExplanations.push(`На позиции «${buildArch.archetypeLabel}» не собрал связку инициации (Blink/Harpoon) и выживаемости (BKB/Pipe/Lotus/Blade Mail/Shiva).`);
      counterMatrix.push({
        status: "failed",
        category: "Инициация и Фронтлейн (Pos 3)",
        threat: `Задачи Pos 3 против пика врага`,
        expectedItems: "Blink + BKB / Pipe / Lotus / Blade Mail",
        playerResponse: "✕ Нет базовой связки инициации и защиты"
      });
    } else {
      counterMatrix.push({
        status: "passed",
        category: "Инициация и Фронтлейн (Pos 3)",
        threat: `Задачи танка-инициатора (${roleInfo.heroName})`,
        expectedItems: "Blink / BKB / Pipe / Blade Mail / Shiva",
        playerResponse: `✓ Собрано по роли Pos 3`
      });
    }
  } else if (!roleInfo.isSupport && enemyControlHeroes.length >= 2) {
    if (isExemptByInnateAndMetaDispel) {
      const dispelNames = metaDispelItemsOwned.map(i => i.name).slice(0, 3).join(", ") || "мета-сейв";
      positiveNotes.push(`Герой ${roleInfo.heroName} имеет встроенный иммунитет/диспел и собрал ${dispelNames} — покупка BKB не требуется.`);
      counterMatrix.push({
        status: "passed",
        category: "Защита от контроля",
        threat: `Контроль врага (${enemyControlHeroes.length}): ${enemyControlNamesStr}`,
        expectedItems: "Встроенный сейв + Manta / Satanic / Disperser",
        playerResponse: `✓ Закрыто механикой героя + ${dispelNames}`
      });
    } else if (needsBkbToHit) {
      if (isHighImpactWinnerOrCarry) {
        counterMatrix.push({
          status: "passed",
          category: "Защита от контроля (BKB)",
          threat: `Контроль врага (${enemyControlHeroes.length}): ${enemyControlNamesStr}`,
          expectedItems: "Black King Bar (BKB)",
          playerResponse: hasBkbInInventory
            ? `✓ Купил BKB${bkbBoughtAtStr ? ` (${bkbBoughtAtStr})` : ""}${wonMatch ? " и выиграл матч" : " против контроля врага"}`
            : wonMatch
              ? "✓ ЗАКРЫТО ПО ИГРЕ: Победа и реализация урона без необходимости в BKB"
              : "✓ ЗАКРЫТО ПО ИГРЕ: Реализовал урон за счет мобильности и позиционки"
        });
      } else if (bkbBoughtAtSec !== null && bkbBoughtAtSec >= 1980 && !wonMatch) {
        hasCriticalBuildMistake = true;
        buildVerdictStatus = "hidden_ruin";
        buildScore -= 32;
        const delayMin = Math.max(8, Math.round((bkbBoughtAtSec - 1380) / 60));

        const greedyBeforeBkb = [];
        for (const pEntry of (purchaseLog || [])) {
          if (pEntry && typeof pEntry.time === "number" && pEntry.time < bkbBoughtAtSec - 30 && GREEDY_DAMAGE_ITEM_KEYS[pEntry.key]) {
            const label = `${GREEDY_DAMAGE_ITEM_KEYS[pEntry.key]} (${formatClock(pEntry.time)})`;
            if (!greedyBeforeBkb.some(x => x.startsWith(GREEDY_DAMAGE_ITEM_KEYS[pEntry.key]))) {
              greedyBeforeBkb.push(label);
            }
          }
        }
        const greedyText = greedyBeforeBkb.length > 0
          ? `до BKB покупал голый урон: ${greedyBeforeBkb.slice(0, 3).join(" → ")}`
          : "отложил покупку защитного слота до глубокого лейта";

        const bkbItemObj = richItems.find(i => i.id === 116);
        if (bkbItemObj) {
          bkbItemObj.timingStatus = "critical_late";
          bkbItemObj.timingNote = `Критическое опоздание: куплен только на ${bkbBoughtAtStr} (норма ~22:00) против ${enemyControlNamesStr}`;
        }

        const bkbLateHeadline = `Скрытый руин билдом: BKB куплен только на ${bkbBoughtAtMin}-й минуте (${bkbBoughtAtStr})!`;
        const bkbLateExp = `На герое ${roleInfo.heroName} критически важно жить и бить в замесе, но против пика с контролем (${enemyControlNamesStr}) он ${greedyText} и взял BKB лишь на ${bkbBoughtAtStr} (опоздание +${delayMin} мин).`;
        criticalHeadlines.push(bkbLateHeadline);
        criticalExplanations.push(bkbLateExp);

        counterMatrix.push({
          status: "failed",
          category: "Защита от контроля (BKB)",
          threat: `Контроль врага (${enemyControlHeroes.length}): ${enemyControlNamesStr}`,
          expectedItems: "Black King Bar к 20–24 мин",
          playerResponse: `✕ Купил BKB только на ${bkbBoughtAtStr} (${bkbBoughtAtMin}м, опоздание +${delayMin}м)`
        });

        buildFindings.push({
          categoryKey: "economy",
          maxCap: 35,
          points: 25,
          badge: `Поздний BKB (${bkbBoughtAtMin}м)`,
          reason: {
            type: "ballast",
            category: "Оценщик билда (ИИ)",
            timestamp: bkbBoughtAtStr,
            title: `Купил BKB только на ${bkbBoughtAtStr} против кучи контроля (${enemyControlNamesStr})`,
            shortPill: `BKB на ${bkbBoughtAtStr} (опоздание +${delayMin} мин)`,
            detail: `Герою ${roleInfo.heroName} нужно много бить в драке, но ${greedyText}, взяв BKB лишь на ${bkbBoughtAtMin}-й минуте против ${enemyControlNamesStr}.`
          }
        });

        buildFindings.push({
          categoryKey: "timeline",
          maxCap: 60,
          points: 12,
          badge: null,
          reason: {
            type: "ballast",
            category: "Мидгейм без BKB",
            timestamp: `20:00–${bkbBoughtAtStr}`,
            title: `Дрался без BKB до ${bkbBoughtAtMin}-й минуты в ключевых файтах`,
            shortPill: `Без BKB против ${enemyControlHeroes.slice(0, 3).join(", ")}`,
            detail: `С 20-й минуты до ${bkbBoughtAtStr} выходил в командные замесы без Black King Bar против пика с жестким контролем.`
          }
        });
      } else if (bkbBoughtAtSec !== null && bkbBoughtAtSec >= 1650 && !wonMatch) {
        if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
        buildScore -= 14;
        const delayMin = Math.max(5, Math.round((bkbBoughtAtSec - 1380) / 60));
        const bkbItemObj = richItems.find(i => i.id === 116);
        if (bkbItemObj) {
          bkbItemObj.timingStatus = "late";
          bkbItemObj.timingNote = `Поздний BKB на ${bkbBoughtAtStr} (опоздание +${delayMin} мин) против ${enemyControlNamesStr}`;
        }
        warningHeadlines.push(`Запоздалый BKB на ${bkbBoughtAtStr} против контроля (${enemyControlNamesStr})`);
        warningExplanations.push(`На ${roleInfo.heroName} затянул покупку Black King Bar до ${bkbBoughtAtMin}-й минуты (норма ~22:00) против ${enemyControlNamesStr}.`);

        counterMatrix.push({
          status: "warning",
          category: "Защита от контроля (BKB)",
          threat: `Контроль врага (${enemyControlHeroes.length}): ${enemyControlNamesStr}`,
          expectedItems: "Black King Bar к 20–24 мин",
          playerResponse: `⚠ Запоздалый BKB на ${bkbBoughtAtStr} (+${delayMin} мин от нормы)`
        });

        buildFindings.push({
          categoryKey: "economy",
          maxCap: 35,
          points: 16,
          badge: `Поздний BKB (${bkbBoughtAtMin}м)`,
          reason: {
            type: "ballast",
            category: "Оценщик билда (ИИ)",
            timestamp: bkbBoughtAtStr,
            title: `Затянул покупку BKB до ${bkbBoughtAtStr} против контроля (${enemyControlNamesStr})`,
            shortPill: `BKB на ${bkbBoughtAtStr} (опоздание +${delayMin} мин)`,
            detail: `Против ${enemyControlNamesStr} на ${roleInfo.heroName} BKB требовался к 22–24 минуте, но появился только на ${bkbBoughtAtStr}.`
          }
        });
      } else if (!hasBkbInInventory && !hasLinkensInInventory && bkbBoughtAtSec === null && durationMin >= 26 && enemyControlHeroes.length >= 2 && !wonMatch) {
        hasCriticalBuildMistake = true;
        buildVerdictStatus = "hidden_ruin";
        buildScore -= 28;
        const noBkbHeadline = `Полный игнор BKB на ${roleInfo.heroName} против пика с контролем (${enemyControlNamesStr})!`;
        const noBkbExp = `За ${Math.round(durationMin)} минут на бьющем коре ${roleInfo.heroName} вообще не купил Black King Bar против ${enemyControlNamesStr}, из-за чего стоял в станах/сайленсах в замесах (${deaths} смертей).`;
        criticalHeadlines.push(noBkbHeadline);
        criticalExplanations.push(noBkbExp);

        counterMatrix.push({
          status: "failed",
          category: "Защита от контроля (BKB)",
          threat: `Контроль врага (${enemyControlHeroes.length}): ${enemyControlNamesStr}`,
          expectedItems: "Black King Bar (BKB)",
          playerResponse: `✕ 0 BKB за ${Math.round(durationMin)} мин (${deaths} смертей)`
        });

        buildFindings.push({
          categoryKey: "economy",
          maxCap: 35,
          points: 22,
          badge: "Без BKB против контроля",
          reason: {
            type: "ballast",
            category: "Оценщик билда (ИИ)",
            timestamp: "Весь матч",
            title: `Отказался от BKB против кучи контроля (${enemyControlNamesStr})`,
            shortPill: `0 BKB за ${Math.round(durationMin)} мин (${deaths} смертей)`,
            detail: `На ${roleInfo.heroName} собрал слоты без Black King Bar против ${enemyControlNamesStr}, лишив себя возможности свободно бить в драке.`
          }
        });
      } else if (hasBkbInInventory) {
        counterMatrix.push({
          status: "passed",
          category: "Защита от контроля (BKB)",
          threat: `Контроль врага (${enemyControlHeroes.length}): ${enemyControlNamesStr}`,
          expectedItems: "Black King Bar (BKB)",
          playerResponse: `✓ Купил BKB${bkbBoughtAtStr ? ` вовремя (${bkbBoughtAtStr})` : ""}`
        });
      }
    }
  }

  // Проверка Linken's Sphere
  if (hasLinkensInInventory) {
    const linkenItemObj = richItems.find(i => i.id === 123);
    const linkenTimeStr = (linkenItemObj && linkenItemObj.boughtAt) || "Матч";
    const isUselessNoSingleTarget = enemySingleTargetHeroes.length === 0;
    const isBadLinkenInsteadOfBkb = !hasBkbInInventory && enemyAoEControlHeroes.length >= 2 && (enemyCheapLinkenPoppers.length >= 1 || enemySingleTargetHeroes.length <= 1);

    if (isUselessNoSingleTarget || isBadLinkenInsteadOfBkb) {
      if (linkenItemObj) {
        linkenItemObj.timingStatus = "useless";
        linkenItemObj.timingNote = "Пустой нетворс: Linken's Sphere не защищает от AoE-контроля и легко сбивается";
      }
      if (buildVerdictStatus === "good") buildVerdictStatus = "empty_networth";
      buildScore -= 22;
      const linkenHeadline = "Пустой нетворс: Linken's Sphere (4 800 🪙) куплена на ветер";
      const linkenExp = isUselessNoSingleTarget
        ? `У врагов нет опасных направленных ультимейтов (весь контроль идет по площади: ${enemyAoEControlHeroes.join(", ")}), поэтому Линка за 4 800 золота не приносит пользы.`
        : `Против ${[...enemyCheapLinkenPoppers, ...enemyAoEControlHeroes].slice(0, 4).join(", ")} Линка мгновенно сбивается дешевыми скиллами и не заменяет BKB.`;
      warningHeadlines.push(linkenHeadline);
      warningExplanations.push(linkenExp);

      counterMatrix.push({
        status: "failed",
        category: "Защита от таргет-скиллов (Linken's)",
        threat: isUselessNoSingleTarget ? `Только AoE-контроль (${enemyAoEControlHeroes.slice(0, 3).join(", ")})` : `Сбивалки Линки (${enemyCheapLinkenPoppers.join(", ")})`,
        expectedItems: "Black King Bar / Satanic / Lotus",
        playerResponse: "✕ Пустой нетворс: 4 800 🪙 в бесполезную Linken's Sphere"
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: 18,
        badge: "Пустой нетворс (Линка)",
        reason: {
          type: "ballast",
          category: "Пустой нетворс",
          timestamp: linkenTimeStr,
          title: "Деньги на ветер: бесполезная Linken's Sphere (4 800 🪙) против этого пика",
          shortPill: "4 800 🪙 в пустой слот",
          detail: linkenExp
        }
      });
    } else {
      positiveNotes.push(`Грамотная покупка Linken's Sphere под направленные способности врага (${enemySingleTargetHeroes.join(", ")}).`);
      counterMatrix.push({
        status: "passed",
        category: "Защита от таргет-ультов (Linken's)",
        threat: `Направленный фокус: ${enemySingleTargetHeroes.slice(0, 3).join(", ")}`,
        expectedItems: "Linken's Sphere / Lotus Orb",
        playerResponse: "✓ Купил Linken's Sphere по пику врага"
      });
    }
  }

  // =========================================================================
  // ПРОВЕРКА 6 МАТРИЦЫ: АНТИ-ИЛЛЮЗИИ (AoE), СЕЙВ САППОРТОВ И АКТУАЛЬНАЯ МЕТА
  // =========================================================================
  const hasAoEItem = hasAnyItem([158, 166, 145, 137, 1466, 119]);
  if (enemyIllusionSwarm.length >= 1) {
    const illuStr = enemyIllusionSwarm.join(", ");
    const hasInnateAoE = INNATE_AOE_CLEAR_HERO_IDS.has(player.hero_id);
    if (hasAoEItem || hasInnateAoE) {
      const aoeItemName = hasItem(158) ? "Mjollnir" : hasItem(145) ? "Battle Fury" : hasItem(137) ? "Radiance" : hasItem(1466) ? "Gleipnir" : hasItem(119) ? "Shiva's Guard" : hasItem(166) ? "Maelstrom" : "Встроенный AoE";
      counterMatrix.push({
        status: "passed",
        category: "Анти-иллюзии (AoE)",
        threat: `Иллюзии / Клоны: ${illuStr}`,
        expectedItems: "Mjollnir / Battle Fury / Radiance / Shiva",
        playerResponse: `✓ Есть зачистка: ${aoeItemName}`
      });
    } else if (teamHasAoEClear || arch === "SUPPORT_UTILITY" || arch === "OFFLANE_TANK_INITIATOR" || arch === "OFFLANE_DUELIST" || isDominatingKillerCore) {
      counterMatrix.push({
        status: "passed",
        category: "Анти-иллюзии (AoE)",
        threat: `Иллюзии / Клоны: ${illuStr}`,
        expectedItems: "Командный AoE / Соло-фокус главной цели",
        playerResponse: isDominatingKillerCore
          ? `✓ ЗАКРЫТО ФОКУСОМ: Вырезал цели за берст (${kills} фрагов)`
          : teamHasAoEClear
            ? "✓ ЗАКРЫТО КОМАНДОЙ (AoE-зачистка уже есть у союзников)"
            : "✓ ЗАКРЫТО ПО РОЛИ"
      });
    } else if (arch === "CARRY_STRIKER" && durationMin >= 28 && netWorth >= 16000 && !wonMatch) {
      const illuHeadline = `Нет AoE-зачистки против иллюзий (${illuStr})`;
      const illuDetail = `Против ${illuStr} в команде не хватало AoE-урона (Mjollnir / Battle Fury / Radiance / Gleipnir).`;
      if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
      buildScore -= 12;
      warningHeadlines.push(illuHeadline);
      warningExplanations.push(illuDetail);

      counterMatrix.push({
        status: "warning",
        category: "Анти-иллюзии (AoE)",
        threat: `Иллюзии / Клоны: ${illuStr}`,
        expectedItems: "Mjollnir / Battle Fury / Radiance / Gleipnir",
        playerResponse: "⚠ Соло-таргет билд без AoE против иллюзий"
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: 10,
        badge: null,
        reason: {
          type: "ballast",
          category: "Оценщик билда (ИИ)",
          timestamp: "Контр-закуп",
          title: illuHeadline,
          shortPill: `0 AoE-слотов против ${illuStr}`,
          detail: illuDetail
        }
      });
    }
  }

  // =========================================================================
  // БАЛАНС ОТВЕТСТВЕННОСТИ САППОРТОВ (Pos 4 / Pos 5): РЕАЛЬНЫЕ СЕЙВ-СЛОТЫ VS ЖАДНЫЙ ЗАКУП
  // =========================================================================
  const REAL_SUPPORT_SAVE_ITEM_IDS = new Set([
    79,   // Mekansm
    81,   // Vladmir's Offering
    90,   // Pipe of Insight
    96,   // Scythe of Vyse (Hex)
    100,  // Eul's Scepter
    102,  // Force Staff
    185,  // Drum of Endurance
    206,  // Rod of Atos
    210,  // Heaven's Halberd
    226,  // Lotus Orb
    229,  // Solar Crest
    231,  // Guardian Greaves
    242,  // Crimson Guard
    254,  // Glimmer Cape
    263,  // Hurricane Pike
    267,  // Spirit Vessel
    269,  // Holy Locket
    610,  // Wind Waker
    931,  // Boots of Bearing
    1128  // Pavise
  ]);

  const EXPANDED_GREEDY_SUPPORT_ITEM_IDS = new Set([
    ...GREEDY_SUPPORT_CARRY_ITEM_IDS,
    65,   // Hand of Midas
    98,   // Orchid Malevolence
    104,  // Dagon 1
    112,  // Assault Cuirass
    114,  // Heart of Tarrasque
    121,  // Bloodstone
    133,  // Divine Rapier
    149,  // Crystalys
    154,  // Sange and Yasha
    172,  // Mask of Madness
    174,  // Diffusal Blade
    176,  // Ethereal Blade
    208,  // Abyssal Blade
    223,  // Meteor Hammer
    225,  // Nullifier
    235,  // Octarine Core
    236,  // Dragon Lance
    252,  // Echo Sabre
    259,  // Kaya and Sange
    277,  // Yasha and Kaya
    534,  // Witch Blade
    597,  // Parasma
    692,  // Eternal Shroud
    911,  // Revenant's Brooch
    939,  // Harpoon
    1097, // Disperser
    1100, // Phylactery
    1107, // Khanda
    1164, // Parasma
    1806  // Parasma
  ]);

  let supportWentGreedyNoSave = false;

  if (arch === "SUPPORT_UTILITY" && durationMin >= 18 && netWorth >= 4500) {
    const saveUtilityOwned = richItems.filter(i => REAL_SUPPORT_SAVE_ITEM_IDS.has(i.id));
    const greedyCarryOwned = richItems.filter(i =>
      EXPANDED_GREEDY_SUPPORT_ITEM_IDS.has(i.id) ||
      (i.id === 108 && saveUtilityOwned.length === 0)
    );

    // Проверяем также съеденный Аганим или Мидас в purchase_log при 0 сейвов
    if (saveUtilityOwned.length === 0 && greedyCarryOwned.length === 0) {
      if (player.aghanims_scepter === 1) {
        greedyCarryOwned.push({ id: 108, name: "Aghanim's Scepter" });
      } else if (Array.isArray(purchaseLog) && purchaseLog.some(e => e && e.key === "hand_of_midas")) {
        greedyCarryOwned.push({ id: 65, name: "Hand of Midas" });
      }
    }

    if (saveUtilityOwned.length === 0 && greedyCarryOwned.length >= 1) {
      supportWentGreedyNoSave = true;
      const greedyNames = greedyCarryOwned.map(i => i.name).join(", ");
      const supHeadline = `Жадная сборка на саппорте ${roleInfo.heroName} (${greedyNames}) при 0 сейв-предметов!`;
      const supDetail = `На позиции «${roleInfo.roleLabel}» вместо Glimmer Cape / Force Staff / Solar Crest / Lotus Orb / Pavise потратил золото на жадные слоты (${greedyNames}), оставив команду без подсейва.`;

      buildScore -= wonMatch ? 24 : 32;
      if (!wonMatch || deaths >= 8) {
        hasCriticalBuildMistake = true;
        buildVerdictStatus = "hidden_ruin";
        criticalHeadlines.push(supHeadline);
        criticalExplanations.push(supDetail);
      } else {
        if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
        warningHeadlines.push(supHeadline);
        warningExplanations.push(supDetail);
      }

      counterMatrix.push({
        status: "failed",
        category: "Сейв-слоты саппорта",
        threat: `Подсейв союзников против ${enemyControlNamesStr || "фокуса врага"}`,
        expectedItems: "Glimmer Cape / Force Staff / Solar Crest / Lotus Orb / Pavise",
        playerResponse: `✕ 0 сейвов (купил ${greedyNames})`
      });

      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: !wonMatch ? 24 : (deaths >= 8 ? 20 : 14),
        badge: "Саппорт без сейв-слотов",
        reason: {
          type: "ballast",
          category: "Оценщик билда (ИИ)",
          timestamp: "Сборка саппорта",
          title: supHeadline,
          shortPill: `0 сейвов (${greedyNames})`,
          detail: supDetail
        }
      });
    } else if (saveUtilityOwned.length >= 1) {
      counterMatrix.push({
        status: "passed",
        category: "Сейв-слоты саппорта",
        threat: `Защита союзных коров в драках`,
        expectedItems: "Force Staff / Glimmer / Solar Crest / Lotus / Pavise",
        playerResponse: `✓ Собрано: ${saveUtilityOwned.map(i => i.name).slice(0, 3).join(", ")}`
      });
    } else if (!wonMatch && durationMin >= 25 && netWorth >= 5500) {
      if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
      buildScore -= 14;
      const noSaveWarn = `Саппорт ${roleInfo.heroName} не собрал ни одного сейв-слота за ${Math.round(durationMin)} мин`;
      warningHeadlines.push(noSaveWarn);
      warningExplanations.push(`На позиции «${roleInfo.roleLabel}» к концу игры нет ни Force Staff, ни Glimmer Cape, ни Solar Crest / Pavise.`);
      counterMatrix.push({
        status: "failed",
        category: "Сейв-слоты саппорта",
        threat: `Защита союзных коров в драках`,
        expectedItems: "Force Staff / Glimmer Cape / Solar Crest / Pavise",
        playerResponse: `✕ 0 командных сейв-предметов за ${Math.round(durationMin)} мин`
      });
      buildFindings.push({
        categoryKey: "economy",
        maxCap: 35,
        points: 15,
        badge: "Саппорт без сейв-слотов",
        reason: {
          type: "ballast",
          category: "Сборка саппорта",
          timestamp: "Весь матч",
          title: noSaveWarn,
          shortPill: "0 сейв-артефактов за матч",
          detail: `За ${Math.round(durationMin)} минут на позиции поддержки не купил ни одного предмета для спасения союзников.`
        }
      });
    }
  }

  // Механическая анти-синергия: Battle Fury (#145) или Echo Sabre/Harpoon (#252/#939) на герое дальнего боя (Ranged)
  if (buildArch.isRanged && (hasItem(145) || hasItem(252) || hasItem(939))) {
    const badMeleeItem = hasItem(145) ? "Battle Fury" : hasItem(939) ? "Harpoon" : "Echo Sabre";
    const antiSynHeadline = `Анти-синергия механики Доты: ${badMeleeItem} куплен на герое дальнего боя (${roleInfo.heroName})!`;
    const antiSynDetail = `Пассивная способность ${badMeleeItem} (сплэш / двойной удар) в Dota 2 работает ТОЛЬКО у героев ближнего боя! Покупка этого предмета на дальнике ${roleInfo.heroName} — грубый слив золота.`;
    hasCriticalBuildMistake = true;
    buildVerdictStatus = "empty_networth";
    buildScore -= 35;
    criticalHeadlines.push(antiSynHeadline);
    criticalExplanations.push(antiSynDetail);

    counterMatrix.push({
      status: "failed",
      category: "Механика предметов",
      threat: `Герой дальнего боя (${roleInfo.heroName})`,
      expectedItems: "Dragon Lance / Hurricane Pike / Manta / Gleipnir",
      playerResponse: `✕ Купил ${badMeleeItem} (не работает на дальниках)`
    });

    buildFindings.push({
      categoryKey: "economy",
      maxCap: 35,
      points: 24,
      badge: `Руин-билд (${badMeleeItem} на дальнике)`,
      reason: {
        type: "sabotage",
        category: "Пустой нетворс",
        timestamp: "Механика Доты",
        title: antiSynHeadline,
        shortPill: `${badMeleeItem} не работает на Ranged`,
        detail: antiSynDetail
      }
    });
  }

  // Проверка окупаемости фарм-слотов (Midas, Battle Fury, Radiance)
  const hasMidas = hasItem(65) || (Array.isArray(purchaseLog) && purchaseLog.some(x => x && x.key === "hand_of_midas"));
  const hasBfury = hasItem(145);
  const hasRadiance = hasItem(137);
  const towerDmgNow = player.tower_damage || 0;
  const farmItemPaidOffByMacro = playerGpm >= 600 || towerDmgNow >= 4000 || (player.last_hits || 0) >= durationMin * 9.5;

  if (!roleInfo.isSupport && durationMin >= 24 && (hasBfury || hasRadiance || hasMidas) && playerDpg < 0.80 && !farmItemPaidOffByMacro && !wonMatch) {
    const farmItemName = hasBfury ? "Battle Fury" : hasRadiance ? "Radiance" : "Hand of Midas";
    const farmItemId = hasBfury ? 145 : hasRadiance ? 137 : 65;
    const farmItemObj = richItems.find(i => i.id === farmItemId);
    if (farmItemObj && farmItemObj.timingStatus === "ok") {
      farmItemObj.timingStatus = "useless";
      farmItemObj.timingNote = `Не окупился: с ${farmItemName} нанес всего ${playerDpg.toFixed(2)} урона на 1 золото и не разогнал темп`;
    }
    if (buildVerdictStatus === "good") buildVerdictStatus = "empty_networth";
    buildScore -= 15;
    warningHeadlines.push(`Пустой нетворс: ${farmItemName} не окупился и не дал ни фарма, ни урона`);
    warningExplanations.push(`Купил слот на разгон фарма (${farmItemName}), но за ${Math.round(durationMin)} минут не разогнал экономику (GPM ${playerGpm}) и дал лишь ${playerDpg.toFixed(2)} урона на единицу золота.`);
  }

  // Соответствие живой мете героя
  const RAW_COMPONENT_NAMES_BLACKLIST = new Set([
    "Mithril Hammer", "Ogre Axe", "Broadsword", "Claymore", "Demon Edge", "Eaglesong",
    "Reaver", "Sacred Relic", "Hyperstone", "Mystic Staff", "Ultimate Orb", "Platemail",
    "Quarterstaff", "Javelin", "Blade of Alacrity", "Staff of Wizardry", "Point Booster",
    "Vitality Booster", "Energy Booster", "Talisman of Evasion", "Shadow Amulet",
    "Perseverance", "Oblivion Staff", "Cornucopia", "Ghost Scepter"
  ]);

  const cleanTopMetaNames = metaProfile.topMetaItemNames.filter(n => !RAW_COMPONENT_NAMES_BLACKLIST.has(n));
  const validUniversalSituationalIds = new Set([1, 37, 48, 50, 63, 79, 81, 90, 96, 98, 100, 102, 108, 110, 112, 114, 116, 119, 121, 123, 127, 135, 139, 141, 143, 147, 152, 154, 156, 158, 160, 168, 174, 176, 180, 206, 208, 210, 214, 220, 223, 225, 226, 229, 231, 232, 235, 242, 249, 250, 252, 254, 256, 259, 263, 267, 273, 277, 534, 597, 598, 600, 603, 604, 610, 692, 911, 931, 939, 1097, 1100, 1107, 1466]);
  const majorOwned = richItems.filter(i => i.major && !i.boots);

  if (majorOwned.length >= 2 && !invAudit.isTrollOrAbsurdBuild) {
    if (arch === "SUPPORT_UTILITY" && supportWentGreedyNoSave) {
      counterMatrix.push({
        status: "warning",
        category: "Актуальная мета (STRATZ / OpenDota)",
        threat: `Мета-ядро для ${roleInfo.heroName} (${buildArch.archetypeLabel})`,
        expectedItems: "Force Staff, Glimmer Cape, Solar Crest, Lotus Orb",
        playerResponse: `⚠ Не по роли саппорта: ${majorOwned.map(i => i.name).slice(0, 4).join(", ")}`
      });
    } else {
      const metaMatchedItems = majorOwned.filter(
        i => metaProfile.topMetaItemIds.includes(i.id) || META_DISPEL_OR_SAVE_ITEM_IDS.has(i.id) || validUniversalSituationalIds.has(i.id)
      );
      const directHeroMetaMatched = majorOwned.filter(i => metaProfile.topMetaItemIds.includes(i.id));
      const metaMatchPct = Math.round((Math.max(directHeroMetaMatched.length, Math.ceil(metaMatchedItems.length * 0.90)) / majorOwned.length) * 100);
      const expectedMetaStr = arch === "SUPPORT_UTILITY" && PURE_POS1_CARRY_HERO_IDS.has(player.hero_id)
        ? "Force Staff, Glimmer Cape, Solar Crest, Aghanim's Scepter"
        : cleanTopMetaNames.slice(0, 4).join(", ");

      counterMatrix.push({
        status: "passed",
        category: "Актуальная мета (STRATZ / OpenDota)",
        threat: `Мета-ядро для ${roleInfo.heroName} (${buildArch.archetypeLabel})`,
        expectedItems: expectedMetaStr,
        playerResponse: `✓ По мете (${Math.min(100, metaMatchPct)}%): ${(directHeroMetaMatched.length > 0 ? directHeroMetaMatched : metaMatchedItems).map(i => i.name).slice(0, 4).join(", ")}`
      });
    }
  }

  // Проверка классических опозданий по таймингам
  const delayedItems = [];
  if (Array.isArray(purchaseLog) && purchaseLog.length > 0) {
    for (const [itemKey, rule] of Object.entries(ITEM_TIMING_BENCHMARKS)) {
      if (itemKey === "black_king_bar") continue;
      if (rule.coreOnly && roleInfo.isSupport) continue;
      const entry = purchaseLog.find(p => p.key === itemKey);
      const isLateSixthSlotUtility = itemKey === "blink" && (!BLINK_INITIATOR_HERO_IDS.has(player.hero_id) || (entry && entry.time > 1900 && (player.gold_per_min || 0) >= 520));
      if (entry && entry.time > rule.maxAcceptableSec && !isLateSixthSlotUtility) {
        const delayMin = Math.round((entry.time - rule.expectedSec) / 60);
        delayedItems.push({
          key: itemKey,
          label: rule.label,
          boughtAt: formatClock(entry.time),
          expectedAt: formatClock(rule.expectedSec),
          delayMin
        });
        const matchedInvItem = richItems.find(i => i.slug === itemKey);
        if (matchedInvItem && matchedInvItem.timingStatus === "ok") {
          matchedInvItem.timingStatus = "late";
          matchedInvItem.timingNote = `Поздний тайминг: ${formatClock(entry.time)} (норма ~${formatClock(rule.expectedSec)}, опоздание +${delayMin} мин)`;
        }
      }
    }
  }

  if (delayedItems.length > 0) {
    const worstItem = delayedItems.sort((a, b) => b.delayMin - a.delayMin)[0];
    const timingPts = Math.min(18, 10 + Math.max(0, worstItem.delayMin - 6) * 1.5);
    if (buildVerdictStatus === "good") buildVerdictStatus = "warning";
    buildScore -= 12;
    warningHeadlines.push(`Сорван тайминг ключевого слота: ${worstItem.label} на ${worstItem.boughtAt}`);
    warningExplanations.push(`Ключевой предмет куплен с опозданием на +${worstItem.delayMin} мин относительно нормы (~${worstItem.expectedAt}).`);

    buildFindings.push({
      categoryKey: "economy",
      maxCap: 35,
      points: timingPts,
      badge: null,
      reason: {
        type: "ballast",
        category: "Тайминги",
        timestamp: worstItem.boughtAt,
        title: `Поздний ${worstItem.label} (на ${worstItem.boughtAt})`,
        shortPill: `Опоздание +${worstItem.delayMin} мин`,
        detail: delayedItems.map(d => `${d.label}: ${d.boughtAt} (норма ~${d.expectedAt})`).join(" • ")
      }
    });
  }

  if (arch === "OFFLANE_TANK_INITIATOR" && hasInitiationSlot && hasTankDefensiveOrTeamSlot && !hasCriticalBuildMistake) {
    buildScore = Math.max(88, Math.min(98, buildScore));
    if (buildVerdictStatus === "warning" && delayedItems.length === 0) {
      buildVerdictStatus = "good";
    }
  }

  buildScore = Math.max(15, Math.min(99, Math.round(buildScore)));
  let buildHeadline = "";
  let buildExplanation = "";

  if (criticalHeadlines.length > 0) {
    buildHeadline = criticalHeadlines.length === 1
      ? criticalHeadlines[0]
      : `${criticalHeadlines[0]} (+ ещё ${criticalHeadlines.length - 1} критич. ошибка билда)`;
    buildExplanation = [...criticalExplanations, ...warningExplanations].slice(0, 3).join(" ");
  } else if (warningHeadlines.length > 0) {
    buildHeadline = warningHeadlines[0];
    buildExplanation = warningExplanations.slice(0, 2).join(" ");
  } else if (positiveNotes.length > 0) {
    buildHeadline = `Грамотная мета-сборка на ${roleInfo.heroName} (${buildArch.archetypeLabel})`;
    buildExplanation = positiveNotes.slice(0, 3).join(" ");
  } else {
    buildHeadline = isExemptByInnateAndMetaDispel
      ? `Мета-сборка на ${roleInfo.heroName}: встроенный сейв + ${metaDispelItemsOwned.map(i => i.name).slice(0, 3).join(", ")}`
      : `Сборка на ${roleInfo.heroName} (${buildArch.archetypeLabel}) соответствует мете и пику врага`;
    buildExplanation = enemyControlHeroes.length > 0
      ? `Ключевые слоты (${richItems.filter(i => i.major).map(i => i.name).slice(0, 4).join(", ") || "по роли"}) взяты адекватно против пика врага (${enemyControlNamesStr}).`
      : "Предметы и тайминги основных слотов соответствуют задачам выбранной позиции.";
  }

  const statusOrder = { failed: 0, warning: 1, passed: 2 };
  counterMatrix.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  const finalMatrix = counterMatrix.slice(0, 6);

  for (const item of richItems) {
    if (item.boughtAt) {
      itemTimelinePills.push({
        id: item.id,
        name: item.name,
        boughtAt: item.boughtAt,
        boughtAtMin: item.boughtAtMin,
        status: item.timingStatus,
        note: item.timingNote
      });
    }
  }

  return {
    hasCriticalBuildMistake,
    buildScore,
    archetypeKey: arch,
    archetypeLabel: buildArch.archetypeLabel,
    isPhysicalRightClicker: buildArch.isPhysicalRightClicker,
    teamCounters: {
      teamHasAntiHeal,
      teamHasNullifier,
      teamHasAuraSave,
      teamHasBreak
    },
    targetThreatReport,
    auditMode: Array.isArray(purchaseLog) && purchaseLog.length > 0
      ? "100% Полный AI-аудит (Дерево угроз + Slot Efficiency + Тайминги)"
      : "100% AI-аудит слотов и контр-пика (Дерево угроз + Все 60 слотов)",
    bkbBoughtAtSec,
    bkbBoughtAtStr,
    bkbBoughtAtMin,
    enemyControlHeroes,
    enemyAoEControlHeroes,
    enemySingleTargetHeroes,
    verdictStatus: buildVerdictStatus,
    headline: buildHeadline,
    explanation: buildExplanation,
    counterMatrix: finalMatrix,
    itemTimelinePills,
    findings: buildFindings,
    metaProfile: {
      bkbIsPopular: metaProfile.bkbIsPopular,
      topMetaItemNames: cleanTopMetaNames,
      metaSource: metaProfile.metaSource || "STRATZ / OpenDota Live Meta"
    },
    llmPayload
  };
}

function resolveWardsPlaced(player, roleInfo, durationMin, teamfightParticipationPct, mainItems, matchIsParsed) {
  const hasExplicitWards =
    typeof player.obs_placed === 'number' ||
    typeof player.sen_placed === 'number' ||
    typeof player.wards_placed === 'number';

  if (hasExplicitWards) {
    const exactCount =
      typeof player.wards_placed === 'number'
        ? player.wards_placed
        : (player.obs_placed || 0) + (player.sen_placed || 0);
    if (exactCount > 0 || matchIsParsed) {
      return { wardsPlaced: exactCount, isEstimated: false };
    }
  }

  const obsLogLen = Array.isArray(player.obs_log) ? player.obs_log.length : 0;
  const senLogLen = Array.isArray(player.sen_log) ? player.sen_log.length : 0;
  if (obsLogLen > 0 || senLogLen > 0) {
    return { wardsPlaced: obsLogLen + senLogLen, isEstimated: false };
  }

  if (player.purchase && typeof player.purchase === 'object') {
    const purchasedWards =
      (player.purchase.ward_observer || 0) +
      (player.purchase.ward_sentry || 0) +
      (player.purchase.ward_dispenser || 0);
    if (purchasedWards > 0) {
      return { wardsPlaced: purchasedWards, isEstimated: false };
    }
  }

  if (!matchIsParsed && roleInfo && roleInfo.isSupport && durationMin >= 12) {
    const supportItemsCount = Array.isArray(mainItems)
      ? mainItems.filter(id => SUPPORT_UTILITY_ITEM_IDS.has(id)).length
      : 0;
    const isHardSupport = roleInfo.position === 5;
    const baseRatePerMin = isHardSupport ? 0.52 : 0.32;
    const activityMultiplier =
      (teamfightParticipationPct >= 55 ? 1.15 : teamfightParticipationPct >= 40 ? 0.95 : 0.65) *
      (supportItemsCount >= 2 ? 1.12 : 0.85);

    const estimated = Math.max(2, Math.round(durationMin * baseRatePerMin * activityMultiplier));
    return { wardsPlaced: estimated, isEstimated: true };
  }

  return { wardsPlaced: 0, isEstimated: !matchIsParsed };
}

function resolveJungleStats(player, roleInfo, durationMin, towerDamage, teamfightParticipationPct, mainItems, matchIsParsed) {
  const totalLastHits = Math.max(0, player.last_hits || 0);
  if (totalLastHits === 0) {
    return { lastHits: 0, neutralKills: 0, jungleFarmPct: 0, isEstimated: false };
  }

  const explicitNeutral =
    player.neutral_kills ??
    player.neutrals_killed ??
    player.neutralCreeps ??
    player.jungle_kills ??
    player.stats?.neutral_kills ??
    null;

  if (typeof explicitNeutral === 'number' && explicitNeutral > 0) {
    const pct = Math.min(100, Math.max(0, Math.round((explicitNeutral / totalLastHits) * 100)));
    return { lastHits: totalLastHits, neutralKills: explicitNeutral, jungleFarmPct: pct, isEstimated: false };
  }

  if (player.killed && typeof player.killed === 'object') {
    let fromKilledMap = 0;
    for (const [unitName, count] of Object.entries(player.killed)) {
      if (typeof count === 'number' && (unitName.includes('neutral') || unitName.includes('roshan'))) {
        fromKilledMap += count;
      }
    }
    if (fromKilledMap > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((fromKilledMap / totalLastHits) * 100)));
      return { lastHits: totalLastHits, neutralKills: fromKilledMap, jungleFarmPct: pct, isEstimated: false };
    }
  }

  if (typeof player.lane_kills === 'number' && player.lane_kills > 0 && player.lane_kills <= totalLastHits) {
    const derivedNeutral = Math.max(0, totalLastHits - player.lane_kills);
    const pct = Math.min(100, Math.max(0, Math.round((derivedNeutral / totalLastHits) * 100)));
    return { lastHits: totalLastHits, neutralKills: derivedNeutral, jungleFarmPct: pct, isEstimated: false };
  }

  if (typeof player.jungle_farm_pct === 'number' && player.jungle_farm_pct > 0) {
    const pct = Math.min(100, Math.max(0, Math.round(player.jungle_farm_pct)));
    const derivedNeutral = Math.round((pct / 100) * totalLastHits);
    return { lastHits: totalLastHits, neutralKills: derivedNeutral, jungleFarmPct: pct, isEstimated: false };
  }

  if (matchIsParsed && explicitNeutral === 0 && (roleInfo.isSupport || totalLastHits < 45)) {
    return { lastHits: totalLastHits, neutralKills: 0, jungleFarmPct: 0, isEstimated: false };
  }

  if (totalLastHits < 12 || durationMin < 10) {
    return { lastHits: totalLastHits, neutralKills: 0, jungleFarmPct: 0, isEstimated: true };
  }

  const lhPerMin = totalLastHits / Math.max(1, durationMin);
  const hasFarmItem = Array.isArray(mainItems) && mainItems.some(id => FARM_ACCELERATOR_ITEM_IDS.has(id));
  const heroMeta = HEROES_DB[player.hero_id] || {};
  const heroJungleBias = heroMeta.jungleBias || 0;

  let estRatio = 0.20;
  if (roleInfo.isSupport) {
    estRatio = lhPerMin >= 2.2 ? 0.28 : 0.14;
  } else {
    estRatio = 0.30 + heroJungleBias + Math.min(0.24, Math.max(0, (lhPerMin - 3.8) * 0.045));
    if (hasFarmItem) estRatio += 0.08;
    if (towerDamage < 800 && totalLastHits >= 150 && !roleInfo.isSpellcaster) estRatio += 0.12;
    else if (towerDamage > 5000) estRatio -= 0.08;
    if (teamfightParticipationPct < 35 && totalLastHits >= 160) estRatio += 0.10;
    else if (teamfightParticipationPct >= 65) estRatio -= 0.06;
  }

  estRatio = Math.min(0.84, Math.max(0.08, estRatio));
  const estNeutralKills = Math.round(totalLastHits * estRatio);
  const estPct = Math.min(100, Math.max(0, Math.round((estNeutralKills / totalLastHits) * 100)));

  return {
    lastHits: totalLastHits,
    neutralKills: estNeutralKills,
    jungleFarmPct: estPct,
    isEstimated: true
  };
}

function extractPlayerDeathsTimeline(player, playerIndex, teamfights) {
  const deaths = [];
  if (Array.isArray(player.deaths_log) && player.deaths_log.length > 0) {
    for (const d of player.deaths_log) {
      if (typeof d === 'number') deaths.push({ time: d, source: 'deaths_log' });
      else if (d && typeof d.time === 'number') deaths.push({ time: d.time, by: d.key || null, source: 'deaths_log' });
    }
  }
  if (Array.isArray(teamfights)) {
    for (const tf of teamfights) {
      const pTf = tf.players && tf.players[playerIndex];
      if (pTf && pTf.deaths > 0) {
        const deathTime = tf.last_death || tf.end || tf.start || 0;
        const alreadyRecorded = deaths.some(d => Math.abs(d.time - deathTime) <= 25);
        if (!alreadyRecorded) {
          for (let k = 0; k < pTf.deaths; k++) {
            deaths.push({ time: deathTime - (pTf.deaths - 1 - k) * 8, source: 'teamfight' });
          }
        }
      }
    }
  }
  return deaths.sort((a, b) => a.time - b.time);
}

function computeGoldRanksAtMinute(allPlayers, minuteIndex) {
  const withGold = allPlayers.map(p => {
    if (!Array.isArray(p.gold_t) || p.gold_t.length === 0) {
      return { slot: p.player_slot, goldAtMin: null };
    }
    if (minuteIndex > p.gold_t.length + 1) {
      return { slot: p.player_slot, goldAtMin: null };
    }
    const idx = Math.min(minuteIndex, p.gold_t.length - 1);
    return { slot: p.player_slot, goldAtMin: p.gold_t[idx] ?? null };
  });

  if (withGold.filter(x => x.goldAtMin !== null).length < 6) return null;

  const sorted = [...withGold].sort((a, b) => (b.goldAtMin || 0) - (a.goldAtMin || 0));
  const rankMap = {};
  sorted.forEach((item, idx) => {
    if (item.goldAtMin !== null) {
      rankMap[item.slot] = { rank: idx + 1, gold: item.goldAtMin };
    }
  });
  return rankMap;
}

function resolveBenchmarks(player, roleInfo, durationMin) {
  const bm = player.benchmarks || {};
  const gpm = player.gold_per_min || 300;
  const xpm = player.xp_per_min || 400;
  const hdPerMin = (player.hero_damage || 0) / Math.max(1, durationMin);
  const td = player.tower_damage || 0;
  const hhPerMin = (player.hero_healing || 0) / Math.max(1, durationMin);

  const clamp01 = v => Math.min(0.99, Math.max(0.01, v));

  const fallbackGpmPct = roleInfo.isSupport
    ? clamp01((gpm - 180) / 260)
    : clamp01((gpm - 320) / 420);
  const fallbackXpmPct = roleInfo.isSupport
    ? clamp01((xpm - 250) / 380)
    : clamp01((xpm - 380) / 480);
  const fallbackHdPct = roleInfo.isSupport
    ? clamp01((hdPerMin - 180) / 450)
    : clamp01((hdPerMin - 350) / 750);
  const fallbackTdPct = clamp01(td / 6000);
  const fallbackHhPct = clamp01(hhPerMin / 180);

  return {
    gpmPct: bm.gold_per_min?.pct ?? fallbackGpmPct,
    xpmPct: bm.xp_per_min?.pct ?? fallbackXpmPct,
    hdPct: bm.hero_damage_per_min?.pct ?? fallbackHdPct,
    tdPct: bm.tower_damage?.pct ?? fallbackTdPct,
    hhPct: bm.hero_healing_per_min?.pct ?? fallbackHhPct,
    stunsPct: bm.stuns_per_min?.pct ?? 0.5
  };
}

/**
 * Контекстный аудит каждого замеса (teamfights) v4.2
 */
// Архетип макро-керри и сплит-пушеров, чья задача до ключевых слотов — толкать линии и ломать базу, а не бежать в ранние драки 5v5
const SPLIT_PUSH_MACRO_HERO_IDS = new Set([
  1,   // Anti-Mage
  10,  // Morphling
  12,  // Phantom Lancer
  53,  // Nature's Prophet
  61,  // Broodmother
  77,  // Lycan
  80,  // Lone Druid
  82,  // Meepo
  89,  // Naga Siren
  109, // Terrorblade
  113  // Arc Warden
]);

// Плотные силовики, темповые борцы и ганкеры, в которых сплит-пушеру нельзя просто бежать драться в лоб на 15–22 минуте
const EARLY_BRAWL_AND_CATCH_ENEMY_IDS = new Set([
  2,   // Axe
  4,   // Bloodseeker
  16,  // Sand King
  17,  // Storm Spirit
  18,  // Sven
  19,  // Tiny
  23,  // Kunkka
  28,  // Slardar
  29,  // Tidehunter
  38,  // Beastmaster
  42,  // Wraith King
  47,  // Viper
  49,  // Dragon Knight
  51,  // Clockwerk
  54,  // Lifestealer
  59,  // Huskar
  60,  // Night Stalker
  65,  // Batrider
  69,  // Doom
  70,  // Ursa
  71,  // Spirit Breaker
  78,  // Brewmaster
  81,  // Chaos Knight
  85,  // Undying
  96,  // Centaur Warrunner
  98,  // Timbersaw
  99,  // Bristleback
  104, // Legion Commander
  129, // Mars
  135, // Dawnbreaker
  137  // Primal Beast
]);

/**
 * Минимальный оценщик драфта для макро-керри / сплит-пушеров:
 * Проверяет, насколько вражеский пик опасен для ранних лобовых драк 5v5 (например Sven + Axe + Spirit Breaker + Undying)
 */
function evaluateDraftForSplitPush(playerHeroId, enemyPlayers = []) {
  const isSplitPushHero = SPLIT_PUSH_MACRO_HERO_IDS.has(Number(playerHeroId));
  const enemyBrawlers = [];
  for (const ep of enemyPlayers) {
    const hId = Number(ep.hero_id);
    if (EARLY_BRAWL_AND_CATCH_ENEMY_IDS.has(hId)) {
      const hName = (HEROES_DB[hId] && HEROES_DB[hId].name) || ep.hero_name || `Hero #${hId}`;
      enemyBrawlers.push(hName);
    }
  }
  return {
    isSplitPushHero,
    enemyBrawlers,
    isHostileEarlyDraft: enemyBrawlers.length >= 2,
    brawlersSummary: enemyBrawlers.slice(0, 4).join(", ")
  };
}

/**
 * Контекстный аудит каждого замеса (teamfights) с проверкой реального присутствия в бою
 * (исправлен баг с глобальным xp_delta, из-за которого сплит-пушер на другом конце карты получал "Зажал кнопки")
 */
// Список вражеского контроля сквозь BKB и мгновенного дизейбла для проверки "Погиб за контроль до нажатия кнопок"
const BKB_PIERCING_AND_INSTANT_LOCKDOWN_ABILITIES = {
  axe_berserkers_call: "Axe (Berserker's Call)",
  legion_commander_duel: "Legion Commander (Duel)",
  faceless_void_chronosphere: "Faceless Void (Chronosphere)",
  enigma_black_hole: "Enigma (Black Hole)",
  magnataur_reverse_polarity: "Magnus (Reverse Polarity)",
  bane_fiends_grip: "Bane (Fiend's Grip)",
  doom_bringer_doom: "Doom (Doom)",
  pudge_dismember: "Pudge (Dismember)",
  beastmaster_primal_roar: "Beastmaster (Primal Roar)",
  batrider_flaming_lasso: "Batrider (Flaming Lasso)",
  winter_wyvern_winters_curse: "Winter Wyvern (Winter's Curse)",
  treant_overgrowth: "Treant Protector (Overgrowth)",
  spirit_breaker_nether_strike: "Spirit Breaker (Nether Strike)",
  marci_dispose: "Marci (Dispose)",
  primal_beast_pulverize: "Primal Beast (Pulverize)"
};

const INSTANT_STUN_OR_SILENCE_ABILITIES = {
  lion_impale: "Lion (Earth Spike)",
  lion_voodoo: "Lion (Hex)",
  shadow_shaman_voodoo: "Shadow Shaman (Hex)",
  shadow_shaman_shackles: "Shadow Shaman (Shackles)",
  puck_waning_rift: "Puck (Waning Rift)",
  puck_dream_coil: "Puck (Dream Coil)",
  disruptor_static_storm: "Disruptor (Static Storm)",
  silencer_global_silence: "Silencer (Global Silence)",
  centaur_hoof_stomp: "Centaur (Hoof Stomp)",
  slardar_slithereen_crush: "Slardar (Slithereen Crush)",
  sandking_burrowstrike: "Sand King (Burrowstrike)",
  tiny_avalanche: "Tiny (Avalanche)",
  mars_spear: "Mars (Spear of Mars)",
  rattletrap_hookshot: "Clockwerk (Hookshot)",
  storm_spirit_electric_vortex: "Storm Spirit (Electric Vortex)",
  nyx_assassin_impale: "Nyx Assassin (Impale)"
};

/**
 * Собирает использованный врагами контроль (сквозь BKB и мгновенные хексы/станы с блинка) в конкретном тимфайте
 */
function extractEnemyLockdownInFight(tf, enemyIndices) {
  const bkbPiercingUsed = [];
  const instantLockdownUsed = [];

  for (const eIdx of enemyIndices) {
    const epTf = tf.players && tf.players[eIdx];
    if (!epTf) continue;
    const abUses = epTf.ability_uses || {};
    const itUses = epTf.item_uses || {};

    for (const [abKey, label] of Object.entries(BKB_PIERCING_AND_INSTANT_LOCKDOWN_ABILITIES)) {
      if ((abUses[abKey] || 0) > 0 && !bkbPiercingUsed.includes(label)) {
        bkbPiercingUsed.push(label);
      }
    }
    for (const [abKey, label] of Object.entries(INSTANT_STUN_OR_SILENCE_ABILITIES)) {
      if ((abUses[abKey] || 0) > 0 && !instantLockdownUsed.includes(label)) {
        instantLockdownUsed.push(label);
      }
    }
    if ((itUses.sheepstick || 0) > 0 && !instantLockdownUsed.includes("Scythe of Vyse (Hex)")) {
      instantLockdownUsed.push("Scythe of Vyse (Hex)");
    }
    if ((itUses.abyssal_blade || 0) > 0 && !bkbPiercingUsed.includes("Abyssal Blade")) {
      bkbPiercingUsed.push("Abyssal Blade");
    }
    if (((itUses.orchid || 0) > 0 || (itUses.bloodthorn || 0) > 0) && !instantLockdownUsed.includes("Orchid/Bloodthorn")) {
      instantLockdownUsed.push("Orchid/Bloodthorn");
    }
  }

  return {
    bkbPiercingUsed,
    instantLockdownUsed,
    allDisablesUsed: [...bkbPiercingUsed, ...instantLockdownUsed]
  };
}

/**
 * Контекстный аудит каждого замеса (teamfights) v6.0:
 * Различает:
 * — Сценарий А («Погиб за прокаст/контроль до нажатия кнопок», штраф -35%): в файте враги дали контроль сквозь BKB
 *   (Call, Duel, Chrono, Black Hole, RP, Grip, Doom и др.) ИЛИ мгновенный хекс/стан, а игрок почти не нажал скиллы и умер за фокус.
 * — Сценарий Б («Зажал кнопки в проигранном замесе», полный штраф +20 очк.): игрок жил в файте, нажимал другие скиллы
 *   и наносил урон, но умер, так и не нажав готовый BKB / ульт.
 */
function analyzeTeamfightImpact(player, playerIndex, teamfights, purchaseLog, mainItems, roleInfo, isRadiant) {
  const highImpactFights = [];
  const instantBurstWithoutBkbFights = [];
  const passiveObserverFights = [];
  const lockedDownBeforeButtonsFights = [];
  let totalFightDamage = 0;

  if (!Array.isArray(teamfights) || teamfights.length === 0) {
    return {
      highImpactFights,
      instantBurstWithoutBkbFights,
      passiveObserverFights,
      lockedDownBeforeButtonsFights,
      totalFightDamage: 0,
      turningPointFight: null
    };
  }

  let lastUltUseTime = -9999;
  const allyIndices = isRadiant ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];
  const enemyIndices = isRadiant ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  let worstFightDelta = -999999;
  let turningPointFight = null;

  const hasBkbInFinalSlots = mainItems.includes(116);
  const isSplitPushCarry = SPLIT_PUSH_MACRO_HERO_IDS.has(Number(player.hero_id));

  for (const tf of teamfights) {
    const tfStart = tf.start || 0;
    const tfEnd = tf.end || tfStart + 30;
    const pTf = tf.players && tf.players[playerIndex];
    if (!pTf) continue;

    const dmg = pTf.damage || 0;
    const healing = pTf.healing || 0;
    const deaths = pTf.deaths || 0;
    const kills = pTf.kills || 0;
    const assists = pTf.assists || 0;
    totalFightDamage += dmg;

    const allyDeaths = allyIndices.reduce((acc, idx) => acc + ((tf.players[idx] && tf.players[idx].deaths) || 0), 0);
    const enemyDeaths = enemyIndices.reduce((acc, idx) => acc + ((tf.players[idx] && tf.players[idx].deaths) || 0), 0);
    const teamFightDamage = allyIndices.reduce((acc, idx) => acc + ((tf.players[idx] && tf.players[idx].damage) || 0), 0);
    const fightDmgShare = teamFightDamage > 0 ? dmg / teamFightDamage : 0;

    const abUses = pTf.ability_uses || {};
    const itUses = pTf.item_uses || {};
    const totalOtherAbilitiesPressed = Object.values(abUses).reduce((s, v) => s + Number(v || 0), 0);

    const usedUltInFight = roleInfo.bigUlt ? (abUses[roleInfo.bigUlt] || 0) > 0 : false;
    const ultWasReady = Boolean(roleInfo.bigUlt && (tfStart - lastUltUseTime >= roleInfo.ultCd));
    if (usedUltInFight) {
      lastUltUseTime = tfEnd;
    }

    const highDmgThreshold = tfStart < 1500 ? 2300 : 3200;
    const isStrongFightImpact =
      dmg >= highDmgThreshold ||
      (dmg >= 2600 && fightDmgShare >= 0.38) ||
      (roleInfo.isSupport && (dmg + healing >= 3200));

    if (isStrongFightImpact) {
      highImpactFights.push({
        time: formatClock(tfStart),
        timeSec: tfStart,
        damage: dmg,
        kills,
        assists,
        deaths,
        dmgSharePct: Math.round(fightDmgShare * 100),
        diedSacrificially: deaths > 0 && kills === 0
      });
    }

    const bkbBoughtBeforeFight = purchaseLog.length > 0
      ? purchaseLog.some(p => p.key === 'black_king_bar' && p.time <= tfStart - 10)
      : (tfStart >= 1500 && hasBkbInFinalSlots);

    const playerReallyHadBkb = hasBkbInFinalSlots && bkbBoughtBeforeFight;
    const pressedBkbInFight = (itUses.black_king_bar || 0) > 0;

    // Проверяем действия врагов в этом же тимфайте
    const enemyLockdown = extractEnemyLockdownInFight(tf, enemyIndices);
    const hasBkbPiercingLockdown = enemyLockdown.bkbPiercingUsed.length > 0;
    const hasAnyHardEnemyLockdown = enemyLockdown.allDisablesUsed.length > 0;

    const wasActuallyInFightRange = deaths > 0 || dmg >= 350 || kills > 0 || assists > 0;
    const isSituationalFinisherUlt = Number(player.hero_id) === 1 || Number(player.hero_id) === 2 || Number(player.hero_id) === 36;

    if (!roleInfo.isSupport && wasActuallyInFightRange && tfStart >= 900 && !isStrongFightImpact && (deaths > 0 || allyDeaths >= 3)) {
      if (!(isSplitPushCarry && deaths === 0 && tfStart < 1500)) {
        const missedInLostFight = [];
        if (ultWasReady && !usedUltInFight && roleInfo.ultLabel) {
          if (!isSituationalFinisherUlt || deaths > 0) {
            missedInLostFight.push(roleInfo.ultLabel);
          }
        }
        if (playerReallyHadBkb && !pressedBkbInFight && (deaths > 0 || dmg >= 450)) {
          missedInLostFight.push('BKB');
        }
        for (const item of CRITICAL_ACTIVE_ITEMS) {
          if (item.key === 'black_king_bar') continue;
          if (item.coreOnly && roleInfo.isSupport) continue;
          const hasInFinal = mainItems.includes(item.itemId);
          const boughtBefore = purchaseLog.length > 0
            ? item.variants.some(vKey => purchaseLog.some(p => p.key === vKey && p.time <= tfStart - 10))
            : (tfStart >= 1500 && hasInFinal);
          const pressed = item.variants.some(vKey => (itUses[vKey] || 0) > 0);
          if (hasInFinal && boughtBefore && !pressed && (deaths > 0 || dmg >= 450)) {
            missedInLostFight.push(item.label);
          }
        }

        const uniqueMissed = [...new Set(missedInLostFight)];
        if (uniqueMissed.length > 0 && (dmg < 1200 || (deaths > 0 && dmg < 1850))) {
          // СЦЕНАРИЙ А: Игрок погиб в этом файте, и враги нажали контроль сквозь BKB (Call, Duel, Chrono, Black Hole, RP, Grip, Doom и др.)
          // ИЛИ игрок нанес почти 0 урона (< 420 ед., нажал <= 1 скилла) под мгновенным хексом/станом врага
          const diedInLockdownBeforePressing =
            deaths > 0 &&
            (hasBkbPiercingLockdown || (dmg < 420 && totalOtherAbilitiesPressed <= 1 && hasAnyHardEnemyLockdown));

          if (diedInLockdownBeforePressing) {
            const disableListStr = (hasBkbPiercingLockdown ? enemyLockdown.bkbPiercingUsed : enemyLockdown.allDisablesUsed)
              .slice(0, 3)
              .join(', ');
            lockedDownBeforeButtonsFights.push({
              time: formatClock(tfStart),
              timeSec: tfStart,
              damage: dmg,
              allyDeaths,
              missedButtons: uniqueMissed,
              enemyDisables: disableListStr || 'фокус-контроль с инициации'
            });
          } else if (deaths > 0 && dmg < 600 && playerReallyHadBkb && !pressedBkbInFight && !hasBkbPiercingLockdown) {
            instantBurstWithoutBkbFights.push({
              time: formatClock(tfStart),
              timeSec: tfStart,
              damage: dmg,
              kills,
              assists,
              allyDeaths,
              missedButtons: uniqueMissed
            });
          } else {
            // СЦЕНАРИЙ Б: Игрок жил в файте, нажимал другие скиллы и наносил урон, но зажал готовый BKB / ульт
            passiveObserverFights.push({
              time: formatClock(tfStart),
              timeSec: tfStart,
              damage: dmg,
              allyDeaths,
              missedButtons: uniqueMissed
            });
          }
        }
      }
    }

    const fightSwing = (allyDeaths - enemyDeaths) * 200 + (deaths > 0 ? 350 : 0) - dmg * 0.08;
    if (fightSwing > worstFightDelta && (deaths > 0 || allyDeaths >= 3)) {
      worstFightDelta = fightSwing;
      turningPointFight = {
        time: formatClock(tfStart),
        damage: dmg,
        kills,
        assists,
        deaths,
        allyDeaths,
        enemyDeaths,
        isHighImpact: isStrongFightImpact
      };
    }
  }

  return {
    highImpactFights,
    instantBurstWithoutBkbFights,
    passiveObserverFights,
    lockedDownBeforeButtonsFights,
    totalFightDamage,
    turningPointFight
  };
}

function buildForensicInsights(playerObj, turningPointFight, matchDurationFormatted) {
  const { role, stats, teamfight_participation_pct, dmg_share_pct, tower_share_pct, tower_damage, damage_per_gold, isSupport, high_impact_fights_count, badges, build_audit, items } = playerObj;

  let turningPoint;
  if (badges.includes('Жертва без байбека')) {
    const bbReason = (playerObj.reasons || []).find(r => r.category === 'Лейт');
    turningPoint = {
      time: bbReason ? bbReason.timestamp : matchDurationFormatted,
      title: `Критическая смерть без байбека (${bbReason ? bbReason.timestamp : matchDurationFormatted})`,
      text: `Погиб в лейте при нетворсе ${stats.net_worth.toLocaleString('ru-RU')} 🪙 без выкупа, после чего враги закончили игру.`
    };
  } else if (turningPointFight) {
    if (turningPointFight.isHighImpact && turningPointFight.deaths > 0 && (isSupport || damage_per_gold >= 1.0)) {
      turningPoint = {
        time: turningPointFight.time,
        title: `Замес на ${turningPointFight.time}: дал ${turningPointFight.damage.toLocaleString('ru-RU')} урона`,
        text: `Погиб при ${turningPointFight.kills} киллах, но внес огромный урон по врагам.`
      };
    } else if (turningPointFight.deaths > 0) {
      turningPoint = {
        time: turningPointFight.time,
        title: `Потерянный замес на ${turningPointFight.time}`,
        text: `Урон: ${turningPointFight.damage.toLocaleString('ru-RU')} • Команда потеряла ${turningPointFight.allyDeaths} героев.`
      };
    } else {
      turningPoint = {
        time: turningPointFight.time,
        title: `Крупный замес на ${turningPointFight.time}`,
        text: `Погибло ${turningPointFight.allyDeaths} союзников (урон игрока: ${turningPointFight.damage.toLocaleString('ru-RU')}).`
      };
    }
  } else {
    turningPoint = {
      time: matchDurationFormatted,
      title: stats.deaths >= 9 ? `${stats.deaths} смертей за матч` : 'Потеря контроля карты',
      text: `За ${matchDurationFormatted} враг перехватил преимущество по золоту.`
    };
  }

  let innocence;
  if (!isSupport && (tower_damage >= 7000 || (tower_damage >= 4500 && (tower_share_pct || 0) >= 60))) {
    innocence = {
      title: `Снес ${tower_share_pct || 70}% строений команды (${tower_damage.toLocaleString('ru-RU')} урона башням)`,
      text: `Держал макро-игру сплит-пушем и в одиночку создавал давление на вражескую базу.`
    };
  } else if (!isSupport && damage_per_gold < 0.85 && teamfight_participation_pct < 42) {
    innocence = {
      title: `Нафармил ${stats.net_worth.toLocaleString('ru-RU')} золота, но не реализовал в драках`,
      text: `Участие в драках всего ${teamfight_participation_pct}%, а урон на 1 золото — ${damage_per_gold} (не хватило импакта по героям).`
    };
  } else if (high_impact_fights_count > 0 && (isSupport || damage_per_gold >= 1.05)) {
    innocence = {
      title: `Внес ${dmg_share_pct}% командного урона`,
      text: 'Даже умирая без добивания фрагов, выдавал высокий урон в драках.'
    };
  } else if (teamfight_participation_pct >= 58) {
    innocence = {
      title: `Участвовал в ${teamfight_participation_pct}% драк команды`,
      text: 'Не стоял АФК в лесу и постоянно подключался к командным действиям.'
    };
  } else if (stats.deaths <= 4) {
    innocence = {
      title: `Всего ${stats.deaths} смертей за игру`,
      text: 'Держал аккуратную позицию и не кормил вражеских коров.'
    };
  } else {
    innocence = {
      title: `Оценка с учетом роли «${role}»`,
      text: 'Алгоритм оценивает вклад игрока относительно задач его позиции.'
    };
  }

  let lessonAction;
  const actuallyBoughtLinkens = Array.isArray(items) && items.includes(123);

  if (badges.includes('Жертва без байбека') && !isSupport) {
    lessonAction = 'На первой позиции с огромным нетворсом после 35-й минуты не трать байбек агрессивно и не подставляйся на карте, пока выкуп в кулдауне — одна такая смерть стоит трона.';
  } else if (build_audit && build_audit.hasCriticalBuildMistake) {
    const failedCounters = Array.isArray(build_audit.counterMatrix)
      ? build_audit.counterMatrix.filter(c => c.status === "failed")
      : [];
    if (failedCounters.some(c => c.category.includes("Nullifier"))) {
      lessonAction = "На физ-керри против Eul's Scepter / Ghost Scepter / Glimmer / Force Staff обязательно собирай Nullifier 3–4 слотом, чтобы цели не уходили из-под фокуса.";
    } else if (failedCounters.some(c => c.category.includes("MKB"))) {
      lessonAction = "Против Butterfly или встроенного уклонения (PA / WR / Arc Warden) райткликер обязан покупать Monkey King Bar (True Strike).";
    } else if (failedCounters.some(c => c.category.includes("Сейв-слоты саппорта"))) {
      lessonAction = "На 4 и 5 позиции всегда собирай минимум один сейв-предмет (Force Staff, Glimmer Cape, Solar Crest, Lotus Orb) до покупки жадных слотов в урон.";
    } else if (failedCounters.some(c => c.category.includes("Break"))) {
      lessonAction = "Против Bristleback, Spectre или Timbersaw обязательно собирай Silver Edge для отключения пассивок (Break).";
    } else if (failedCounters.some(c => c.category.includes("Анти-хил"))) {
      lessonAction = "Против героев с сильным регеном/вампиризмом (Huskar, Morphling, Alchemist, Satanic, Heart) покупай Spirit Vessel, Shiva's Guard или Eye of Skadi.";
    } else if (build_audit.bkbBoughtAtMin) {
      lessonAction = `Против пика с контролем бери BKB 2-м или 3-м слотом (~20–23 мин), а не на ${build_audit.bkbBoughtAtMin}-й минуте после слотов на голый урон.`;
    } else {
      lessonAction = "Адаптируй сборку под конкретный пик и предметы врага (BKB против контроля, MKB против уклонения, Nullifier против сейвов).";
    }
  } else if (build_audit && build_audit.verdictStatus === 'empty_networth' && actuallyBoughtLinkens) {
    lessonAction = "Оценивай скиллы врагов перед покупкой защитного слота: не бери Linken's Sphere против AoE-контроля или дешевых сбивалок.";
  } else if (badges.includes('Пойман в контроль до БКБ')) {
    lessonAction = 'Держи позицию до врыва вражеского инициатора (Axe / LC / Magnus / Void) и не показывайся на линии до того, как увидишь опасный контроль сквозь BKB.';
  } else if (badges.includes('Умер в стане с БКБ') || badges.includes('Хранитель кнопок')) {
    lessonAction = 'Жми BKB превентивно до влета вражеского контроля.';
  } else if (badges.includes('Жертва без байбека')) {
    lessonAction = 'После 35-й минуты всегда оставляй золото и кулдаун на выкуп для защиты базы.';
  } else if (!isSupport && tower_damage >= 7000 && damage_per_gold < 0.88) {
    lessonAction = 'Отличный сплит-пуш по вышкам, но после набора 4–5 слотов чаще конвертируй перефарм в командные драки 5 на 5, чтобы не отдавать врагу инициативу.';
  } else if (badges.includes('Пацифист строений') || badges.includes('Инвестор в лес')) {
    lessonAction = 'Не застревай в АФК-фарме: на кор-позиции нужно давить вышки и драться с командой.';
  } else if (role.includes('Pos 1') || role.includes('Pos 2')) {
    lessonAction = 'Реализуй тайминги ключевых слотов через командные драки и контроль Рошана.';
  } else {
    lessonAction = 'Держи позицию за спинами коров и обновляй вижен перед смоками.';
  }

  return { turningPoint, innocence, lessonAction };
}

/**
 * Полный расчет метрик, баланса ролей (Коры vs Саппорты), динамической амнистии и карточек улик (v6.0)
 */
function evaluatePlayer(player, playerIndex, matchContext) {
  const {
    durationSec,
    durationMin,
    radiantWin,
    teamKills,
    teamDamage,
    teamPlayers,
    enemyPlayers,
    teamfights,
    ranksAt10,
    ranksAt20,
    matchIsParsed
  } = matchContext;

  const isRadiant = player.player_slot < 128;
  const wonMatch = isRadiant ? radiantWin : !radiantWin;
  const roleInfo = detectRole(player, durationMin, teamPlayers);

  const kills = player.kills || 0;
  const deaths = player.deaths || 0;
  const assists = player.assists || 0;
  const gpm = player.gold_per_min || 0;
  const xpm = player.xp_per_min || 0;

  const estimatedTotalGold = Math.round((gpm || 300) * durationMin);
  const rawTotalGold = player.total_gold || estimatedTotalGold;
  const netWorth =
    player.net_worth ??
    ((player.gold_spent || 0) + (player.gold || 0) > 0
      ? (player.gold_spent || 0) + (player.gold || 0)
      : Math.round(rawTotalGold * 0.78));
  const totalGold = Math.max(1, rawTotalGold, netWorth);

  const heroDamage = player.hero_damage || 0;
  const towerDamage = player.tower_damage || 0;
  const heroHealing = player.hero_healing || 0;
  const teamTowerDamage = Math.max(1, (teamPlayers || []).reduce((s, p) => s + (p.tower_damage || 0), 0));
  const tower_share_pct = Math.min(100, Math.round((towerDamage / teamTowerDamage) * 100));

  const dmg_share_pct = Number(((heroDamage / Math.max(1, teamDamage)) * 100).toFixed(1));
  const damage_per_death = Math.round(heroDamage / Math.max(1, deaths));
  const damage_per_gold = Number((heroDamage / totalGold).toFixed(2));

  const draftSplitInfo = evaluateDraftForSplitPush(player.hero_id, enemyPlayers);
  const isHeavySplitPushCarry =
    !roleInfo.isSupport &&
    (towerDamage >= 7500 ||
      (towerDamage >= 4800 && tower_share_pct >= 55) ||
      (draftSplitInfo.isSplitPushHero && towerDamage >= 4000));

  const mainItems = [
    player.item_0, player.item_1, player.item_2,
    player.item_3, player.item_4, player.item_5
  ].filter(id => id && id > 0);

  const purchaseLog = Array.isArray(player.purchase_log) ? player.purchase_log : [];
  const invAudit = auditInventory(player, mainItems, roleInfo, durationMin, netWorth, purchaseLog);
  const buildAudit = evaluateBuildAndTimings(
    player,
    roleInfo,
    invAudit,
    mainItems,
    purchaseLog,
    matchContext.enemyPlayers,
    matchContext.allPlayers,
    durationMin,
    netWorth,
    deaths,
    wonMatch
  );

  const rawTfp = player.teamfight_participation ?? ((kills + assists) / Math.max(1, teamKills));
  const teamfight_participation_pct = Math.min(100, Math.round(rawTfp * 100));

  const wardStats = resolveWardsPlaced(
    player,
    roleInfo,
    durationMin,
    teamfight_participation_pct,
    mainItems,
    matchIsParsed
  );
  const wardsPlaced = wardStats.wardsPlaced;
  const wardsIsEstimated = wardStats.isEstimated;

  const jungleStats = resolveJungleStats(
    player,
    roleInfo,
    durationMin,
    towerDamage,
    teamfight_participation_pct,
    mainItems,
    matchIsParsed
  );
  const lastHitsReal = jungleStats.lastHits;
  const neutralKills = jungleStats.neutralKills;
  const jungle_farm_pct = jungleStats.jungleFarmPct;

  const networth_preservation_pct = Math.min(100, Math.round((netWorth / totalGold) * 100));
  const { gpmPct, xpmPct, hdPct, tdPct, hhPct, stunsPct } = resolveBenchmarks(player, roleInfo, durationMin);

  const isAfkFarmingCore = !roleInfo.isSupport && !isHeavySplitPushCarry && towerDamage < 3500 && damage_per_gold < 0.88 && teamfight_participation_pct < 45;
  const isHighFightingCore = !roleInfo.isSupport && (teamfight_participation_pct >= 55 || dmg_share_pct >= 24) && hdPct >= 0.50;

  let compositePct;
  if (roleInfo.isSupport) {
    compositePct = Math.max(hdPct * 0.35 + xpmPct * 0.25 + Math.max(hhPct, stunsPct, rawTfp) * 0.40, rawTfp * 0.85);
  } else if (isHeavySplitPushCarry) {
    compositePct = tdPct * 0.40 + gpmPct * 0.25 + hdPct * 0.25 + xpmPct * 0.10;
  } else if (isAfkFarmingCore) {
    compositePct = hdPct * 0.45 + tdPct * 0.30 + rawTfp * 0.25;
  } else if (roleInfo.isSpellcaster || isHighFightingCore) {
    compositePct = hdPct * 0.55 + gpmPct * 0.25 + xpmPct * 0.20;
  } else {
    compositePct = hdPct * 0.40 + gpmPct * 0.25 + xpmPct * 0.15 + tdPct * 0.20;
  }

  const hero_efficiency_percentile = Math.max(1, Math.min(99, Math.round(compositePct * 100)));

  const tfAudit = analyzeTeamfightImpact(
    player,
    playerIndex,
    teamfights,
    purchaseLog,
    mainItems,
    roleInfo,
    isRadiant
  );

  const kaRatioForCredit = (kills + assists) / Math.max(1, deaths);
  const qualifiesForCoreFightCredit =
    !roleInfo.isSupport &&
    !buildAudit.hasCriticalBuildMistake &&
    ((damage_per_gold >= 1.05 &&
      teamfight_participation_pct >= 45 &&
      dmg_share_pct >= 20 &&
      (tfAudit.highImpactFights.length >= 2 || (tfAudit.highImpactFights.length >= 1 && dmg_share_pct >= 25))) ||
     (kills >= 12 && kaRatioForCredit >= 2.0 && (teamfight_participation_pct >= 42 || dmg_share_pct >= 22)));

  const qualifiesForSupportFightCredit =
    roleInfo.isSupport &&
    deaths <= 10 &&
    teamfight_participation_pct >= 60 &&
    tfAudit.highImpactFights.length >= 2 &&
    dmg_share_pct >= 18;

  const hasHighDamageSacrifice = qualifiesForCoreFightCredit || qualifiesForSupportFightCredit;

  const reasons = [];
  const badges = [];

  let economyScore = 0;   // макс 35
  let gameplayScore = 0;  // макс 40
  let benchmarkScore = 0; // макс 25
  let supportAmnesty = 0; // 0..18
  let timelineScore = 0;  // макс 60
  let sabotageScore = 0;

  let macroAmnestyPts = 0;
  let combatAmnestyPts = 0;
  let supportUtilityAmnestyPts = 0;

  function addPenalty(categoryKey, maxCap, rawPoints, reasonObj) {
    if (rawPoints <= 0) return;
    const fullPts = Math.round(rawPoints);
    if (fullPts <= 0) return;

    if (categoryKey === 'economy') {
      economyScore = Math.min(maxCap, economyScore + fullPts);
    } else if (categoryKey === 'gameplay') {
      gameplayScore = Math.min(maxCap, gameplayScore + fullPts);
    } else if (categoryKey === 'benchmark') {
      benchmarkScore = Math.min(maxCap, benchmarkScore + fullPts);
    } else if (categoryKey === 'timeline') {
      timelineScore = Math.min(maxCap, timelineScore + fullPts);
    }

    reasons.push({
      ...reasonObj,
      points: fullPts
    });
  }

  const softScale = wonMatch ? 0.40 : 1.0;

  // =========================================================================
  // 1. ЭКОНОМИКА И ИНВЕНТАРЬ (Макс 35)
  // =========================================================================
  if (durationMin >= 18) {
    if (mainItems.length === 0 && netWorth < 2500) {
      sabotageScore += 85;
      badges.push('Разбил шмотки');
      addPenalty('economy', 35, 35, {
        type: 'sabotage',
        category: 'Инвентарь',
        timestamp: formatClock(durationSec - 60),
        title: 'Продал или сломал все предметы',
        shortPill: `0 слотов (${netWorth} 🪙)`,
        detail: `К концу игры все 6 слотов пусты (ценность ${netWorth} из ${totalGold.toLocaleString('ru-RU')} золота).`
      });
    } else if (networth_preservation_pct < 38 && mainItems.length <= 2 && !roleInfo.isSupport) {
      const pts = Math.min(30, Math.round(18 + (40 - networth_preservation_pct) * 0.8));
      sabotageScore += 65;
      badges.push('Разбил шмотки');
      addPenalty('economy', 35, pts, {
        type: 'sabotage',
        category: 'Инвентарь',
        timestamp: formatClock(durationSec - 90),
        title: 'Слил стоимость инвентаря',
        shortPill: `Сохранил ${networth_preservation_pct}% золота`,
        detail: `Осталось ${netWorth.toLocaleString('ru-RU')} из ${totalGold.toLocaleString('ru-RU')} золота (${mainItems.length}/6 слотов).`
      });
    }
  }

  if (invAudit.isTrollOrAbsurdBuild) {
    sabotageScore += 45;
  }

  if (invAudit.isSeverelyUndergeared && sabotageScore === 0) {
    badges.push('Пустой инвентарь');
    const gearPts = Math.round(Math.min(18, 10 + Math.max(0, invAudit.nwDeficitPct - 20) * 0.3) * softScale);
    addPenalty('economy', 35, gearPts, {
      type: 'ballast',
      category: 'Инвентарь',
      timestamp: formatClock(durationSec),
      title: `Слабый закуп для ${Math.round(durationMin)}-й минуты`,
      shortPill: `NW ${netWorth.toLocaleString('ru-RU')} vs норма ${invAudit.expectedNw.toLocaleString('ru-RU')}`,
      detail: `К концу игры собрано всего ${invAudit.majorItemsCount} крупных слота (отставание по ценности инвентаря на ${invAudit.nwDeficitPct}% от нормы роли).`
    });
  }

  if (!roleInfo.isSupport && durationMin >= 20) {
    if (damage_per_gold < 0.88) {
      if (isHeavySplitPushCarry) {
        const splitDpgPts = Math.min(16, Math.round((10 + (0.88 - damage_per_gold) * 20) * softScale));
        addPenalty('economy', 35, splitDpgPts, {
          type: 'ballast',
          category: 'Реализация нетворса',
          timestamp: 'Весь матч',
          title: `Низкая реализация огромного нетворса в тимфайтах (${damage_per_gold} урон/🪙)`,
          shortPill: `${heroDamage.toLocaleString('ru-RU')} урона при ${netWorth.toLocaleString('ru-RU')} NW`,
          detail: `Забрал огромную долю ресурсов карты (${lastHitsReal} крипов, ${gpm} GPM) и отлично давил башни (${towerDamage.toLocaleString('ru-RU')} TD), но нанес мало урона по вражеским героям в драках (${heroDamage.toLocaleString('ru-RU')}).`
        });
      } else {
        const dpgPts = Math.min(22, Math.round((12 + (0.90 - damage_per_gold) * 25) * softScale));
        addPenalty('economy', 35, dpgPts, {
          type: 'ballast',
          category: 'Фарм',
          timestamp: 'Весь матч',
          title: 'Фармил впустую (мало урона за золото)',
          shortPill: `${damage_per_gold} урона на 1 🪙`,
          detail: `Нанес всего ${heroDamage.toLocaleString('ru-RU')} урона при ${totalGold.toLocaleString('ru-RU')} заработанного золота.`
        });

        if (towerDamage < 3800 && (jungle_farm_pct >= 50 || (lastHitsReal >= 220 && teamfight_participation_pct < 42))) {
          badges.push('Инвестор в лес');
          const jPts = Math.round(14 * softScale);
          addPenalty('economy', 35, jPts, {
            type: 'ballast',
            category: 'Лес',
            timestamp: 'АФК-фарм',
            title: 'Всю игру бил лесных крипов без урона и без пуша',
            shortPill: `${lastHitsReal} крипов • ${damage_per_gold} урон/🪙`,
            detail: `Добил ${lastHitsReal} крипов (${jungle_farm_pct}% в лесу), но не сломал башни (${towerDamage.toLocaleString('ru-RU')} TD) и дал лишь ${heroDamage.toLocaleString('ru-RU')} урона.`
          });
        }
      }
    }
  }

  const maxHoardedGold = Math.max(player.gold ?? 0, player.unspent_gold ?? 0, player.max_unspent_gold || 0);
  const isSixSlotted = mainItems.length >= 6 && netWorth >= 25000;
  if (!wonMatch && maxHoardedGold > 4500 && !isSixSlotted) {
    const hoardPts = Math.round(Math.min(18, 12 + ((maxHoardedGold - 4500) / 1000) * 2) * softScale);
    addPenalty('economy', 35, hoardPts, {
      type: 'ballast',
      category: 'Инвентарь',
      timestamp: formatClock(durationSec),
      title: 'Держал золото в кармане вместо слотов',
      shortPill: `${maxHoardedGold.toLocaleString('ru-RU')} 🪙 на руках`,
      detail: `Не потратил ${maxHoardedGold.toLocaleString('ru-RU')} золота при неполном закупе (${mainItems.length}/6 слотов).`
    });
  }

  for (const finding of buildAudit.findings) {
    if (finding.badge && !badges.includes(finding.badge)) {
      badges.push(finding.badge);
    }
    const scaledPts = Math.round(finding.points * softScale);
    addPenalty(finding.categoryKey, finding.maxCap, scaledPts, finding.reason);
  }

  if (roleInfo.isJungler) {
    if (!badges.includes('🌲 Лесник (Pos 6)')) {
      badges.unshift('🌲 Лесник (Pos 6)');
    }
    const jGriefPts = Math.round((wonMatch ? 14 : 22) * softScale);
    addPenalty('gameplay', 40, jGriefPts, {
      type: 'ballast',
      category: 'Лесник (Pos 6)',
      timestamp: '00:00–10:00',
      title: 'Ушел в лес вместо отыгрыша 4/5 позиции (Pos 6 🌲 Лесник)',
      shortPill: `Нейтралов: ${neutralKills} (${jungle_farm_pct}% леса • Вардов: ${wardsPlaced})`,
      detail: `Вместо помощи на линии и контроля карты с первых минут фармил лесных крипов (${neutralKills} нейтралов), оставив команду стоять линии 4v5 и забрав лес у своих коров.`
    });
  }

  // =========================================================================
  // 2. ИМПАКТ В ДРАКАХ, ФИД И ВИЖЕН САППОРТОВ (Макс 40)
  // =========================================================================
  const deathsPerMin = deaths / Math.max(1, durationMin);
  const kaRatio = (kills + assists) / Math.max(1, deaths);

  const justifiedDeathsCount = hasHighDamageSacrifice ? tfAudit.highImpactFights.filter(f => f.deaths > 0).length : 0;
  const effectiveUnjustifiedDeaths = Math.max(0, deaths - justifiedDeathsCount);
  const maxEnemyKills = Math.max(0, ...(enemyPlayers || []).map(ep => ep.kills || 0));

  const isCoreFeeder = !roleInfo.isSupport && deaths >= 12 && kills <= deaths * 0.58;
  const isSupportHeavyFeeder = roleInfo.isSupport && deaths >= 11 && (deathsPerMin >= 0.28 || kaRatio < 1.35);

  if (effectiveUnjustifiedDeaths >= 14 && deathsPerMin >= 0.40 && (kaRatio < 0.65 || (!roleInfo.isSupport && kills <= 5 && deaths >= 16)) && !hasHighDamageSacrifice) {
    const feedPts = Math.min(85, Math.round(55 + (deathsPerMin - 0.38) * 90));
    sabotageScore += feedPts;
    badges.push('Раскормил врага');
    addPenalty('gameplay', 40, 40, {
      type: 'sabotage',
      category: 'Фид',
      timestamp: 'Весь матч',
      title: `Жесткий фид и сноубол врага (счет ${kills}/${deaths}/${assists})`,
      shortPill: `${deaths} смертей (${deathsPerMin.toFixed(2)}/мин)`,
      detail: `Погиб ${deaths} раз за ${Math.round(durationMin)} мин при всего ${kills} фрагах, подарив вражеским корам критический перевес.`
    });
  } else if (!hasHighDamageSacrifice && (
    isCoreFeeder ||
    isSupportHeavyFeeder ||
    (effectiveUnjustifiedDeaths >= 10 && deathsPerMin >= 0.27 && kaRatio < 1.35) ||
    (effectiveUnjustifiedDeaths >= 13 && deathsPerMin >= 0.29)
  )) {
    const baseFeedPts = isCoreFeeder
      ? Math.min(38, Math.max(24, 20 + (effectiveUnjustifiedDeaths - 10) * 3.5 + (maxEnemyKills >= 18 ? 4 : 0)))
      : isSupportHeavyFeeder
        ? Math.min(34, Math.max(18, 16 + (effectiveUnjustifiedDeaths - 9) * 3.2))
        : Math.min(32, Math.max(12, (effectiveUnjustifiedDeaths - 8) * 3.2));
    const softFeedPts = Math.round(baseFeedPts * softScale);
    if (deaths >= 12 && !badges.includes('Раскормил врага')) {
      badges.push('Раскормил врага');
    }
    addPenalty('gameplay', 40, softFeedPts, {
      type: 'ballast',
      category: 'Смерти',
      timestamp: 'По ходу игры',
      title: isCoreFeeder
        ? `Провальный счет на кор-роли (${kills}/${deaths}/${assists}) и раскорм врага`
        : isSupportHeavyFeeder
          ? `Фид без размена на саппорте (${kills}/${deaths}/${assists})`
          : `Слишком много смертей (${deaths} за игру)`,
      shortPill: `Счет ${kills}/${deaths}/${assists}`,
      detail: `Умирал без выгодного размена (средний урон за жизнь: ${damage_per_death.toLocaleString('ru-RU')})${maxEnemyKills >= 18 ? `, позволив вражескому кору набрать ${maxEnemyKills} фрагов` : ''}.`
    });
  }

  if ((player.leaver_status || 0) >= 2) {
    sabotageScore += 80;
    addPenalty('gameplay', 40, 35, {
      type: 'sabotage',
      category: 'Лив',
      timestamp: 'Лив',
      title: 'Ливнул из матча',
      shortPill: 'Бросил команду 4v5',
      detail: 'Игрок отключился до падения трона.'
    });
  }

  const minExpectedTowerDmg = roleInfo.isPusher ? 2500 : 1500;
  if (!roleInfo.isSupport && !hasHighDamageSacrifice && durationMin >= 20) {
    if (teamfight_participation_pct < 42 && towerDamage < minExpectedTowerDmg) {
      const afkCorePts = Math.round(Math.min(22, 14 + Math.max(0, (45 - teamfight_participation_pct) * 0.5)) * softScale);
      addPenalty('gameplay', 40, afkCorePts, {
        type: 'ballast',
        category: 'Макро',
        timestamp: 'Вся игра',
        title: 'АФК на кор-роли: ни драк с командой, ни сплит-пуша',
        shortPill: `Драки ${teamfight_participation_pct}% • Башни ${towerDamage.toLocaleString('ru-RU')}`,
        detail: `На позиции «${roleInfo.roleLabel}» пропустил ${100 - teamfight_participation_pct}% фрагов команды и не сломал вышки.`
      });
    } else if (teamfight_participation_pct < 38 && damage_per_gold < 0.90 && !isHeavySplitPushCarry) {
      addPenalty('gameplay', 40, Math.round(16 * softScale), {
        type: 'ballast',
        category: 'Драки',
        timestamp: 'По ходу игры',
        title: `Игнорировал командные драки (участие всего ${teamfight_participation_pct}%)`,
        shortPill: `Драки ${teamfight_participation_pct}% • Урон ${dmg_share_pct}%`,
        detail: `Редко подключался к боям и внес лишь ${heroDamage.toLocaleString('ru-RU')} урона.`
      });
    } else if (isHeavySplitPushCarry && teamfight_participation_pct < 34 && durationMin >= 35 && !wonMatch) {
      const draftExcuse = draftSplitInfo.isHostileEarlyDraft
        ? ` (против плотного пика ${draftSplitInfo.brawlersSummary} сплит-пуш в мидгейме был оправдан, но в лейте команде не хватило урона 5v5)`
        : '';
      addPenalty('gameplay', 40, Math.round(8 * softScale), {
        type: 'ballast',
        category: 'Баланс сплита и драк',
        timestamp: 'Лейт-гейм',
        title: `Перекос в сплит-пуш при низком участии в драках (${teamfight_participation_pct}%)`,
        shortPill: `Драки ${teamfight_participation_pct}% • Снес ${tower_share_pct}% башен`,
        detail: `Отлично давил линии (${towerDamage.toLocaleString('ru-RU')} урона башням), но поучаствовал лишь в ${teamfight_participation_pct}% фрагов команды${draftExcuse}.`
      });
    }
  }

  const isActivelyFightingCarry = kills >= 12 && kaRatio >= 1.75;
  const hasDesolatorOrHugeNw = mainItems.includes(168) || netWorth >= 20000;
  const zeroObjectivesWithTopGear =
    !roleInfo.isSupport &&
    !roleInfo.isSpellcaster &&
    !isActivelyFightingCarry &&
    durationSec >= 1920 &&
    towerDamage < 700 &&
    hasDesolatorOrHugeNw &&
    teamfight_participation_pct < 48;

  const isExemptFromTowerPenalty =
    roleInfo.isSupport ||
    roleInfo.isSpellcaster ||
    isActivelyFightingCarry ||
    (!zeroObjectivesWithTopGear && (hasHighDamageSacrifice || (teamfight_participation_pct >= 50 && damage_per_gold >= 1.10)));

  const towerThresholdForBadge = roleInfo.isPusher ? 2200 : 1200;
  if (!isExemptFromTowerPenalty && durationSec > 1800 && towerDamage < towerThresholdForBadge) {
    badges.push('Пацифист строений');
    const towerPenaltyPts = roleInfo.isPusher ? 16 : 12;
    addPenalty('gameplay', 40, Math.round(towerPenaltyPts * softScale), {
      type: 'ballast',
      category: 'Объекты',
      timestamp: formatClock(durationSec),
      title: roleInfo.isPusher
        ? `Провалил пуш на ${roleInfo.heroName} (всего ${towerDamage.toLocaleString('ru-RU')} урона башням)`
        : zeroObjectivesWithTopGear
          ? `Игнорировал башни при топ-закупе (всего ${towerDamage.toLocaleString('ru-RU')} урона вышкам)`
          : 'Почти не бил вражеские вышки',
      shortPill: `Урон башням: ${towerDamage.toLocaleString('ru-RU')}`,
      detail: zeroObjectivesWithTopGear
        ? `Имея ${netWorth.toLocaleString('ru-RU')} золота${mainItems.includes(168) ? ' и Desolator' : ''}, за ${Math.round(durationMin)} мин нанес всего ${towerDamage.toLocaleString('ru-RU')} урона строениям (гонялся за фрагами вместо сноса базы).`
        : `За ${Math.round(durationMin)} мин на кор-герое ${roleInfo.heroName} нанес лишь ${towerDamage.toLocaleString('ru-RU')} урона строениям (норма > ${towerThresholdForBadge.toLocaleString('ru-RU')}).`
    });
  }

  // ПУНКТ 4: Сценарий А (Погиб за контроль до нажатия кнопок — штраф снижен на 35%) vs Сценарий Б (Реально зажал кнопки — +20 очк.)
  if (tfAudit.lockedDownBeforeButtonsFights.length > 0) {
    badges.push('Пойман в контроль до БКБ');
    const lockCount = tfAudit.lockedDownBeforeButtonsFights.length;
    const firstLock = tfAudit.lockedDownBeforeButtonsFights[0];
    // Базовый штраф 20 очков снижен на 35% -> 13 очков за 1 раз (до 18 за повторные)
    const rawLockPts = Math.round((20 + (lockCount - 1) * 6) * 0.65);
    const lockPts = Math.round(Math.min(18, rawLockPts) * softScale);
    const allTimesStr = tfAudit.lockedDownBeforeButtonsFights.map(f => f.time).join(', ');
    const buttonsStr = firstLock.missedButtons.join(' + ');

    addPenalty('gameplay', 40, lockPts, {
      type: 'ballast',
      category: 'Позиционка в драке',
      timestamp: firstLock.time,
      title: `Погиб за прокаст/контроль до нажатия кнопок (${allTimesStr})`,
      shortPill: `Контроль: ${firstLock.enemyDisables}`,
      detail: `Попал под фокус/контроль (${firstLock.enemyDisables}) и погиб, не успев нажать готовые кнопки: ${buttonsStr}. Ошибка позиционки до врыва.`
    });
  }

  if (tfAudit.instantBurstWithoutBkbFights.length > 0) {
    badges.push('Умер в стане с БКБ');
    const burstCount = tfAudit.instantBurstWithoutBkbFights.length;
    const burstPts = Math.round(Math.min(28, 16 + (burstCount - 1) * 8) * softScale);
    const timesList = tfAudit.instantBurstWithoutBkbFights.map(f => `${f.time} (${f.damage} урона)`).join(', ');

    addPenalty('gameplay', 40, burstPts, {
      type: 'ballast',
      category: 'Драки',
      timestamp: tfAudit.instantBurstWithoutBkbFights[0].time,
      title: `Умер за стан, не нажав готовый BKB (${burstCount} раз)`,
      shortPill: `Таймкоды: ${timesList}`,
      detail: `Влетал в замес с купленным BKB в инвентаре и погибал без нажатия: ${timesList}.`
    });
  }

  if (tfAudit.passiveObserverFights.length > 0) {
    const obsCount = tfAudit.passiveObserverFights.length;
    // Сценарий Б: Реально зажал кнопки в замесе (+20 очков базово)
    const fightPts = Math.round(Math.min(26, 20 + (obsCount - 1) * 6) * softScale);
    if (obsCount + tfAudit.instantBurstWithoutBkbFights.length >= 2) {
      badges.push('Хранитель кнопок');
    }
    const timesOnly = tfAudit.passiveObserverFights.map(f => f.time).join(', ');
    const shortList = tfAudit.passiveObserverFights
      .map(f => `${f.time} (${f.missedButtons.join(' + ')})`)
      .join(', ');

    addPenalty('gameplay', 40, fightPts, {
      type: 'ballast',
      category: 'Драки',
      timestamp: tfAudit.passiveObserverFights[0].time,
      title: `Зажал кнопки в проигранном замесе (${timesOnly})`,
      shortPill: shortList,
      detail: `Жил в файте, нажимал другие способности и наносил урон, но умер, так и не нажав готовые кнопки: ${shortList}.`
    });
  }

  // Провал вижена на саппортах (Pos 4 / Pos 5)
  const minAcceptableWards = roleInfo.position === 5
    ? Math.max(5, Math.round(durationMin * 0.25))
    : Math.max(3, Math.round(durationMin * 0.14));

  if (roleInfo.isSupport && matchIsParsed && !wardsIsEstimated && durationMin >= 20 && wardsPlaced < minAcceptableWards) {
    badges.push('Саппорт без вардов');
    const visionPenalty = wardsPlaced <= 2 ? 18 : 13;
    addPenalty('gameplay', 40, Math.round(visionPenalty * softScale), {
      type: 'ballast',
      category: 'Вижен',
      timestamp: 'Обзор карты',
      title: `Провал вижена на саппорте (всего ${wardsPlaced} вардов за ${Math.round(durationMin)} мин)`,
      shortPill: `Вардов/Сентри: ${wardsPlaced} (норма >= ${minAcceptableWards})`,
      detail: `За ${Math.round(durationMin)} мин на позиции «${roleInfo.roleLabel}» поставил критически мало обсерверов и сентри (${wardsPlaced}), оставив команду играть в темноте.`
    });
  }

  if (isHeavySplitPushCarry && (towerDamage >= 10000 || (towerDamage >= 6000 && tower_share_pct >= 70))) {
    gameplayScore = Math.min(22, gameplayScore);
  }

  // =========================================================================
  // 3. КРИТИЧЕСКИЕ ОШИБКИ ПО ВРЕМЕНИ (Макс 60)
  // =========================================================================
  let rank10 = player.rank_10_min ?? null;
  let rank20 = player.rank_20_min ?? null;
  let gold10 = null;
  let gold20 = null;

  if (ranksAt10 && ranksAt10[player.player_slot]) {
    rank10 = ranksAt10[player.player_slot].rank;
    gold10 = ranksAt10[player.player_slot].gold;
  }
  if (ranksAt20 && ranksAt20[player.player_slot]) {
    rank20 = ranksAt20[player.player_slot].rank;
    gold20 = ranksAt20[player.player_slot].gold;
  }

  const threwLead10To20 = rank10 !== null && rank20 !== null && rank10 <= 2 && rank20 >= 5;
  if (threwLead10To20) {
    badges.push('Король 10 минут');
    const throwPts = Math.round(Math.min(24, 16 + (rank20 - 4) * 2) * softScale);
    addPenalty('timeline', 60, throwPts, {
      type: 'ballast',
      category: 'Темп',
      timestamp: '10:00 → 20:00',
      title: 'Выиграл линию, но слил преимущество к 20-й минуте',
      shortPill: `Нетворс: #${rank10} → #${rank20} место`,
      detail: `Шел топ-${rank10} по золоту на 10:00, но к 20:00 упал на #${rank20}-е место.`
    });
  }

  const deathsTimeline = extractPlayerDeathsTimeline(player, playerIndex, teamfights);
  const buybackLogs = Array.isArray(player.buyback_log) ? player.buyback_log : [];
  const buybackCost = Math.round(200 + netWorth / 13);

  if (durationSec >= 2400 && !wonMatch) {
    const finalWindowStart = durationSec - 180;
    const lateDeaths = deathsTimeline.filter(d => d.time >= finalWindowStart && d.time <= durationSec);

    if (lateDeaths.length > 0 || player.died_without_buyback === true) {
      const deathEvent = lateDeaths[lateDeaths.length - 1] || { time: durationSec - 75 };
      const deathTime = deathEvent.time;
      const goldAtDeath = player.gold_at_fatal_death ?? maxHoardedGold;
      const boughtBackAfter = buybackLogs.some(b => b.time >= deathTime && b.time <= durationSec);
      const prevBuybackOnCd = buybackLogs.find(b => b.time < deathTime && (deathTime - b.time) < 480);

      if (!boughtBackAfter && (goldAtDeath >= buybackCost || prevBuybackOnCd)) {
        badges.push('Жертва без байбека');
        const penalty = roleInfo.isSupport ? 25 : 35;
        const shortCause = prevBuybackOnCd
          ? `Байбек в КД (от ${formatClock(prevBuybackOnCd.time)})`
          : `Было ${goldAtDeath.toLocaleString('ru-RU')} 🪙 (не выкупился)`;

        addPenalty('timeline', 60, penalty, {
          type: 'ballast',
          category: 'Лейт',
          timestamp: formatClock(deathTime),
          title: 'Погиб без байбека перед падением трона',
          shortPill: shortCause,
          detail: `Критическая смерть на ${formatClock(deathTime)} при нетворсе ${netWorth.toLocaleString('ru-RU')} 🪙 оставила команду 4v5 в финальной защите базы.`
        });
      }
    }
  }

  const laningDeaths = deathsTimeline.filter(d => d.time <= 720);
  let maxDeathsIn5Min = 0;
  let tiltWindowStr = '';
  for (let i = 0; i < laningDeaths.length; i++) {
    const startT = laningDeaths[i].time;
    const endT = Math.min(720, startT + 300);
    const inWindow = laningDeaths.filter(d => d.time >= startT && d.time <= endT);
    if (inWindow.length > maxDeathsIn5Min) {
      maxDeathsIn5Min = inWindow.length;
      tiltWindowStr = `${formatClock(startT)}–${formatClock(inWindow[inWindow.length - 1].time)}`;
    }
  }
  if (maxDeathsIn5Min >= 3) {
    const tiltPts = Math.round(Math.min(24, 15 + (maxDeathsIn5Min - 3) * 3.5) * softScale);
    addPenalty('timeline', 60, tiltPts, {
      type: 'ballast',
      category: 'Лайнинг',
      timestamp: tiltWindowStr,
      title: `Слил старт линии (${maxDeathsIn5Min} смерти за 5 мин)`,
      shortPill: `Отрезок ${tiltWindowStr}`,
      detail: `Погиб ${maxDeathsIn5Min} раза подряд до 12-й минуты, раскормив врага.`
    });
  } else if (!hasHighDamageSacrifice && !roleInfo.isSupport && deaths >= 12 && kills <= deaths * 0.58 && (invAudit.nwDeficitPct >= 10 || deathsPerMin >= 0.29 || maxEnemyKills >= 16)) {
    const collapsePts = Math.round(Math.min(30, 18 + Math.max(0, deaths - 11) * 3) * softScale);
    addPenalty('timeline', 60, collapsePts, {
      type: 'ballast',
      category: 'Провал линии и темпа',
      timestamp: '00:00–25:00',
      title: `Провалил свою линию и раскормил вражеского кора (${kills}/${deaths}/${assists})`,
      shortPill: `Смертей: ${deaths}${maxEnemyKills >= 16 ? ` • У вражеского кора ${maxEnemyKills} киллов` : ` • Дефицит золота: ${Math.max(12, invAudit.nwDeficitPct)}%`}`,
      detail: `На позиции «${roleInfo.roleLabel}» погиб ${deaths} раз при ${kills} убийствах (${netWorth.toLocaleString('ru-RU')} 🪙), позволив вражескому кору засноуболить карту.`
    });
  } else if (!hasHighDamageSacrifice && roleInfo.isSupport && deaths >= 13 && deathsPerMin >= 0.31 && kaRatio < 1.30) {
    const supFeedTimePts = Math.round(Math.min(24, 15 + (deaths - 12) * 2.5) * softScale);
    addPenalty('timeline', 60, supFeedTimePts, {
      type: 'ballast',
      category: 'Серийный фид',
      timestamp: 'По ходу матча',
      title: `Непрерывные отдачи по карте на саппорте (${deaths} смертей за матч)`,
      shortPill: `${deathsPerMin.toFixed(2)} смертей/мин • Счет ${kills}/${deaths}/${assists}`,
      detail: `Погиб ${deaths} раз за ${Math.round(durationMin)} мин без позиционки и размена, постоянно оставляя команду в меньшинстве.`
    });
  }

  const earlyRageBuybacks = buybackLogs.filter(b => b.time < 900);
  if (earlyRageBuybacks.length > 0) {
    const bbPts = Math.min(35, earlyRageBuybacks.length * 20);
    sabotageScore += bbPts;
    const timesStr = earlyRageBuybacks.map(b => formatClock(b.time)).join(', ');
    addPenalty('timeline', 60, bbPts, {
      type: 'sabotage',
      category: 'Тильт',
      timestamp: timesStr,
      title: 'Тильтовый байбек на линии',
      shortPill: `Выкуп на ${timesStr}`,
      detail: `Потратил выкуп сразу после смерти на старте игры (${timesStr}).`
    });
  }

  // =========================================================================
  // 4. ОТЫГРЫШ НА ГЕРОЕ И ДИНАМИЧЕСКАЯ ПЛАШКА АМНИСТИИ (Пункт 3 — без хардкода про варды!)
  // =========================================================================
  if (hero_efficiency_percentile < 38 && !hasHighDamageSacrifice && !isHeavySplitPushCarry) {
    const bmPts = Math.round(Math.min(25, Math.max(5, ((40 - hero_efficiency_percentile) / 38) * 24)) * softScale);
    addPenalty('benchmark', 25, bmPts, {
      type: 'ballast',
      category: 'Герой',
      timestamp: 'Итог матча',
      title: `Слабый боевой КПД на герое ${roleInfo.heroName}`,
      shortPill: `Лучше лишь ${hero_efficiency_percentile}% игроков`,
      detail: `Показатели урона по героям и строениям значительно ниже нормы для ${roleInfo.heroName}.`
    });
  }

  // А) МАКРО-АМНИСТИЯ ЗА СНОС СТРОЕНИЙ И СПЛИТ-ПУШ
  if (isHeavySplitPushCarry && sabotageScore === 0 && (towerDamage >= 8000 || (towerDamage >= 5500 && tower_share_pct >= 65))) {
    const macroPushCredit = towerDamage >= 12000 || tower_share_pct >= 75 ? 14 : 10;
    if (!badges.includes('Боец до последнего')) {
      badges.push('Главный пушер (Макро)');
    }
    macroAmnestyPts += macroPushCredit;
    supportAmnesty = Math.min(18, supportAmnesty + macroPushCredit);
    reasons.push({
      type: 'amnesty',
      amnestyKind: 'macro',
      category: '🏰 Макро-амнистия активирована',
      points: -macroPushCredit,
      timestamp: 'По ходу матча',
      title: `🏰 Макро-амнистия активирована (−${macroPushCredit} очк.)`,
      shortPill: `${towerDamage.toLocaleString('ru-RU')} урона башням (${tower_share_pct}% пуша)`,
      detail: `Списано ${macroPushCredit} очков вины за огромный вклад в снос строений и сплит-пуш (${towerDamage.toLocaleString('ru-RU')} урона башням — ${tower_share_pct}% от командного).`
    });
  }

  // Б) БОЕВАЯ АМНИСТИЯ ЗА ВКЛАД В ДРАКИ (hero_damage / KP)
  if (hasHighDamageSacrifice && tfAudit.highImpactFights.length > 0 && sabotageScore === 0) {
    const sacrificialFights = tfAudit.highImpactFights.filter(f => f.deaths > 0);
    const bestFight = [...tfAudit.highImpactFights].sort((a, b) => b.damage - a.damage)[0];
    const fightImpactCredit = Math.min(12, tfAudit.highImpactFights.length * 5 + (sacrificialFights.length > 0 ? 3 : 0));

    if (sacrificialFights.length > 0 || (dmg_share_pct >= 24 && kills <= 5) || kills >= 12) {
      badges.push('Боец до последнего');
    }

    const prevAmnesty = supportAmnesty;
    supportAmnesty = Math.min(18, supportAmnesty + fightImpactCredit);
    const actualCombatCredit = Math.max(1, supportAmnesty - prevAmnesty);
    combatAmnestyPts += actualCombatCredit;

    reasons.push({
      type: 'amnesty',
      amnestyKind: 'combat',
      category: '⚔️ Боевая амнистия активирована',
      points: -actualCombatCredit,
      timestamp: bestFight.time,
      title: `⚔️ Боевая амнистия активирована (−${actualCombatCredit} очк.)`,
      shortPill: `Участие: ${teamfight_participation_pct}% • Урон: ${heroDamage.toLocaleString('ru-RU')}`,
      detail: `Списано ${actualCombatCredit} очков вины за высокий вклад в командные драки (Участие: ${teamfight_participation_pct}%, Урон: ${heroDamage.toLocaleString('ru-RU')}).`
    });
  } else if (hasHighDamageSacrifice && !roleInfo.isSupport && sabotageScore === 0) {
    const unparsedFightCredit = kills >= 14 ? 12 : 10;
    if (!badges.includes('Боец до последнего')) {
      badges.push('Боец до последнего');
    }
    const prevAmnesty = supportAmnesty;
    supportAmnesty = Math.min(18, supportAmnesty + unparsedFightCredit);
    const actualCombatCredit = Math.max(1, supportAmnesty - prevAmnesty);
    combatAmnestyPts += actualCombatCredit;

    reasons.push({
      type: 'amnesty',
      amnestyKind: 'combat',
      category: '⚔️ Боевая амнистия активирована',
      points: -actualCombatCredit,
      timestamp: 'Весь матч',
      title: `⚔️ Боевая амнистия активирована (−${actualCombatCredit} очк.)`,
      shortPill: `Участие: ${teamfight_participation_pct}% • Урон: ${heroDamage.toLocaleString('ru-RU')}`,
      detail: `Списано ${actualCombatCredit} очков вины за высокий вклад в командные драки (Участие: ${teamfight_participation_pct}%, Урон: ${heroDamage.toLocaleString('ru-RU')}).`
    });
  }

  // В) САППОРТ-АМНИСТИЯ (ТОЛЬКО для Pos 4–5 за варды, лечение и сейвы!)
  if (roleInfo.isSupport && sabotageScore === 0 && deaths <= 12 && (wardsPlaced >= 6 || teamfight_participation_pct >= 62)) {
    const campsStacked = player.camps_stacked || 0;
    const realWardsCount = wardsIsEstimated ? 0 : wardsPlaced;
    const wardBonus = realWardsCount >= 16 ? 7 : realWardsCount >= 10 ? 5 : realWardsCount >= 6 ? 3 : 0;
    const tfBonus = teamfight_participation_pct >= 72 ? 6 : teamfight_participation_pct >= 58 ? 4 : 0;
    const utilityBonus = (campsStacked >= 3 ? 2 : 0) + (heroHealing >= 2500 ? 3 : 0);

    const maxSupportCap = deaths >= 11 ? 4 : 12;
    const addedAmnesty = Math.min(Math.max(0, maxSupportCap - supportAmnesty), wardBonus + tfBonus + utilityBonus);
    if (addedAmnesty > 0) {
      supportAmnesty += addedAmnesty;
      supportUtilityAmnestyPts += addedAmnesty;
      reasons.push({
        type: 'amnesty',
        amnestyKind: 'support',
        category: '🛡 Саппорт-амнистия активирована',
        points: -addedAmnesty,
        timestamp: 'За весь матч',
        title: `🛡 Саппорт-амнистия активирована (−${addedAmnesty} очк.)`,
        shortPill: `Вардов: ${wardsPlaced} • Лечение: ${heroHealing.toLocaleString('ru-RU')}`,
        detail: `Списано ${addedAmnesty} очков вины за полезность на карте, сейв и вижен (Вардов: ${wardsPlaced}, Лечение: ${heroHealing.toLocaleString('ru-RU')}).`
      });
    }
  }

  // Формируем единый динамический баннер амнистии (для фронтенда app.js, чтобы никогда не показывать варды у коров Pos 1–3!)
  let amnestyBanner = null;
  if (supportAmnesty > 0) {
    if (macroAmnestyPts > 0 && macroAmnestyPts >= combatAmnestyPts) {
      amnestyBanner = {
        kind: 'macro',
        icon: '🏰',
        title: '🏰 Макро-амнистия активирована',
        text: `Списано ${supportAmnesty} очков вины за огромный вклад в снос строений и сплит-пуш (${towerDamage.toLocaleString('ru-RU')} урона башням — ${tower_share_pct}% от командного).`
      };
    } else if (!roleInfo.isSupport || combatAmnestyPts > supportUtilityAmnestyPts) {
      amnestyBanner = {
        kind: 'combat',
        icon: '⚔️',
        title: '⚔️ Боевая амнистия активирована',
        text: `Списано ${supportAmnesty} очков вины за высокий вклад в командные драки (Участие: ${teamfight_participation_pct}%, Урон: ${heroDamage.toLocaleString('ru-RU')}).`
      };
    } else {
      amnestyBanner = {
        kind: 'support',
        icon: '🛡',
        title: '🛡 Саппорт-амнистия активирована',
        text: `Списано ${supportAmnesty} очков вины за полезность на карте, сейв и вижен (Вардов: ${wardsPlaced}, Лечение: ${heroHealing.toLocaleString('ru-RU')}).`
      };
    }
  }

  const exactSumOfFiveCards = Math.max(
    0,
    Math.min(100, economyScore + gameplayScore + benchmarkScore + timelineScore - supportAmnesty)
  );

  const totalRuinScore = (wonMatch && sabotageScore < 55)
    ? Math.min(24, exactSumOfFiveCards)
    : exactSumOfFiveCards;

  const ruinType = sabotageScore >= 55 && totalRuinScore >= 50
    ? 'Явный руинер (Саботаж)'
    : (!wonMatch && totalRuinScore >= 38)
      ? 'Главный балласт («Якорь»)'
      : totalRuinScore >= 15
        ? 'Ошибался по игре'
        : 'Чистая игра';

  const confidence = Math.min(
    96,
    Math.max(
      52,
      Math.round(
        58 +
        (Array.isArray(teamfights) && teamfights.length > 0 ? 15 : 0) +
        (purchaseLog.length > 0 ? 10 : 0) +
        (Array.isArray(player.gold_t) && player.gold_t.length > 0 ? 7 : 0) +
        roleInfo.roleConfidence * 0.06
      )
    )
  );

  const penaltyReasons = reasons.filter(r => r.points > 0).sort((a, b) => b.points - a.points);
  const shortVerdict = penaltyReasons.length > 0
    ? penaltyReasons[0].title
    : `Чисто отыграл свою роль (${teamfight_participation_pct}% участия в драках)`;

  const verifiedHighImpactCount = hasHighDamageSacrifice ? tfAudit.highImpactFights.length : 0;

  const playerResult = {
    player_slot: player.player_slot,
    account_id: player.account_id || null,
    personaname: player.personaname || 'Анонимный игрок',
    hero_id: player.hero_id,
    hero_name: roleInfo.heroName,
    isRadiant,
    teamName: isRadiant ? 'Radiant (Свет)' : 'Dire (Тьма)',
    wonMatch,
    position: roleInfo.position,
    role: roleInfo.roleLabel,
    roleConfidence: roleInfo.roleConfidence,
    confidence,
    isSupport: roleInfo.isSupport,
    isSpellcaster: roleInfo.isSpellcaster,
    isPusher: roleInfo.isPusher,
    ruinType,
    shortVerdict,
    networth_preservation_pct,
    jungle_farm_pct,
    jungleFarmPct: jungle_farm_pct,
    jungle_is_estimated: jungleStats.isEstimated,
    last_hits: lastHitsReal,
    neutral_kills: neutralKills,
    teamfight_participation_pct,
    dmg_share_pct,
    damage_per_death,
    tower_damage: towerDamage,
    tower_share_pct,
    hero_efficiency_percentile,
    wards_placed: wardsPlaced,
    wards_is_estimated: wardsIsEstimated,
    damage_per_gold,
    high_impact_fights_count: verifiedHighImpactCount,
    instant_bkb_deaths_count: tfAudit.instantBurstWithoutBkbFights.length,
    locked_down_deaths_count: tfAudit.lockedDownBeforeButtonsFights.length,
    amnesty_banner: amnestyBanner,
    badges,
    items: mainItems,
    inventory: invAudit.richItems,
    build_audit: buildAudit,
    expected_net_worth: invAudit.expectedNw,
    nw_deficit_pct: invAudit.nwDeficitPct,
    throw_index: {
      rank_10_min: rank10,
      rank_20_min: rank20,
      gold_10_min: gold10,
      gold_20_min: gold20,
      threw_lead: threwLead10To20
    },
    stats: {
      kills,
      deaths,
      assists,
      kda: ((kills + assists) / Math.max(1, deaths)).toFixed(2),
      gpm,
      xpm,
      last_hits: lastHitsReal,
      neutral_kills: neutralKills,
      net_worth: netWorth,
      total_gold: totalGold,
      unspentGold: maxHoardedGold,
      hero_damage: heroDamage,
      hero_healing: heroHealing,
      teamfight_damage: tfAudit.totalFightDamage || heroDamage,
      dmg_share_pct,
      damage_per_death,
      tower_damage: towerDamage,
      tower_share_pct,
      networth_preservation_pct,
      jungle_farm_pct,
      jungleFarmPct: jungle_farm_pct,
      teamfight_participation_pct,
      hero_efficiency_percentile,
      wards_placed: wardsPlaced,
      wards_is_estimated: wardsIsEstimated,
      damage_per_gold,
      camps_stacked: player.camps_stacked || 0,
      passiveFightCount: tfAudit.passiveObserverFights.length + tfAudit.instantBurstWithoutBkbFights.length
    },
    scores: {
      economy: economyScore,
      gameplay: gameplayScore,
      benchmark: benchmarkScore,
      amnesty: supportAmnesty > 0 ? -supportAmnesty : 0,
      amnesty_title: amnestyBanner ? amnestyBanner.title : null,
      amnesty_text: amnestyBanner ? amnestyBanner.text : null,
      timeline: timelineScore,
      sabotage: Math.min(100, sabotageScore),
      ballast: totalRuinScore,
      total: totalRuinScore
    },
    verdictTier: ruinType,
    reasons
  };

  playerResult.forensics = buildForensicInsights(
    playerResult,
    tfAudit.turningPointFight,
    formatClock(durationSec)
  );

  return playerResult;
}

/**
 * Honorable Mention: Запрос парсинга реплея матча в OpenDota API (POST /api/request/{match_id})
 */
async function requestOpenDotaMatchParse(matchId, options = {}) {
  const cleanId = String(matchId || "").replace(/\D/g, "");
  if (!cleanId) return { ok: false, error: "Некорректный ID матча" };
  const baseUrl = options.openDotaBaseUrl || "https://api.opendota.com/api";
  const timeoutMs = options.timeoutMs || 5000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${baseUrl}/request/${cleanId}`, {
      method: "POST",
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return { ok: false, status: resp.status };
    const data = await resp.json();
    return {
      ok: true,
      jobId: data && data.job ? data.job.jobId : null,
      raw: data
    };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err && err.message ? err.message : "Network error" };
  }
}

/**
 * Генератор «Хронологии матча: как развивалась и где сломалась игра»
 */
function buildMatchChronology(matchData, evaluatedPlayers) {
  const durationSec = matchData.duration || 2400;
  const durationMin = Math.round(durationSec / 60);
  const radiantWin = Boolean(matchData.radiant_win);
  const losingIsRadiant = !radiantWin;
  const losingTeamName = losingIsRadiant ? 'Radiant (Свет)' : 'Dire (Тьма)';
  const winningTeamName = radiantWin ? 'Radiant (Свет)' : 'Dire (Тьма)';
  const teamfights = Array.isArray(matchData.teamfights) ? matchData.teamfights : [];
  const goldAdv = Array.isArray(matchData.radiant_gold_adv) ? matchData.radiant_gold_adv : [];

  const getLosingTeamGoldLeadAtMin = (minIdx) => {
    if (goldAdv.length > 0) {
      const idx = Math.min(Math.max(0, minIdx), goldAdv.length - 1);
      const radAdv = goldAdv[idx] || 0;
      return losingIsRadiant ? radAdv : -radAdv;
    }
    const hasGoldT = matchData.players.some(p => Array.isArray(p.gold_t) && p.gold_t.length > minIdx);
    if (!hasGoldT) return null;
    let radG = 0;
    let direG = 0;
    for (const p of matchData.players) {
      const g = (Array.isArray(p.gold_t) && p.gold_t[Math.min(minIdx, p.gold_t.length - 1)]) || 0;
      if (p.player_slot < 128) radG += g;
      else direG += g;
    }
    return losingIsRadiant ? (radG - direG) : (direG - radG);
  };

  const events = [];

  const leadAt10 = getLosingTeamGoldLeadAtMin(10);
  const laningTilters = evaluatedPlayers.filter(p =>
    p.reasons.some(r => r.category === 'Лайнинг')
  );

  let laningTitle = 'Стадия лайнинга (00:00 – 12:00)';
  let laningText = '';
  let laningPill = 'Старт матча';
  let laningTone = 'neutral';

  if (leadAt10 !== null) {
    if (leadAt10 >= 1500) {
      laningTitle = `Отличный старт от ${losingTeamName}: выиграли линии (+${Math.round(leadAt10 / 100) * 100} 🪙 к 10:00)`;
      laningText = `К 10-й минуте ${losingTeamName} уверенно вели по золоту и контролировали старт игры.`;
      laningPill = `Лидерство +${leadAt10.toLocaleString('ru-RU')} 🪙 на 10:00`;
      laningTone = 'good';
    } else if (leadAt10 <= -2000) {
      laningTitle = `Тяжелый старт для ${losingTeamName}: проиграли линии (${leadAt10.toLocaleString('ru-RU')} 🪙 к 10:00)`;
      laningText = `Уже к 10-й минуте ${winningTeamName} захватили преимущество на линиях и начали давить темпом.`;
      laningPill = `Отставание ${leadAt10.toLocaleString('ru-RU')} 🪙 на 10:00`;
      laningTone = 'warn';
    } else {
      laningTitle = 'Ровный старт на линиях (00:00 – 12:00)';
      laningText = `Первые 10 минут прошли в равной борьбе (разница по золоту всего ~${Math.abs(leadAt10).toLocaleString('ru-RU')} 🪙).`;
      laningPill = 'Равная игра на 10:00';
      laningTone = 'good';
    }
  } else {
    laningText = `Стадия лайнинга определила стартовые роли и первые тайминги предметов обеих команд.`;
  }

  if (laningTilters.length > 0) {
    const tilterStr = laningTilters
      .map(p => {
        const r = p.reasons.find(x => x.category === 'Лайнинг');
        return `${p.personaname} (${p.hero_name}, ${r ? r.timestamp : 'до 12:00'})`;
      })
      .join(', ');
    laningText += ` При этом на линии серию быстрых смертей допустил: ${tilterStr}.`;
    if (laningTone === 'good') laningTone = 'warn';
  }

  events.push({
    sortTimeSec: 600,
    time: '00:00–12:00',
    tag: '🟢 СТАРТ И ЛИНИИ',
    tone: laningTone,
    title: laningTitle,
    description: laningText,
    pill: laningPill
  });

  if (teamfights.length > 0) {
    const lastUltEndByIdx = {};
    const lastBkbEndByIdx = {};
    const analyzedFights = [];

    for (let fIdx = 0; fIdx < teamfights.length; fIdx++) {
      const tf = teamfights[fIdx];
      const tfStart = tf.start || 0;
      const tfEnd = tf.end || tfStart + 30;
      const tfMin = Math.floor(tfStart / 60);

      const losingIndices = losingIsRadiant ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];
      const winningIndices = losingIsRadiant ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];

      let losingDeaths = 0;
      let winningDeaths = 0;
      let losingDamage = 0;
      let winningDamage = 0;
      let losingGoldDelta = 0;

      const deadLosingPlayers = [];
      const ultsOnCooldown = [];
      const unpressedReadyButtons = [];
      const coresWithoutBkbInFight = [];
      const absentCores = [];

      for (const idx of winningIndices) {
        const pTf = tf.players && tf.players[idx];
        if (!pTf) continue;
        winningDeaths += pTf.deaths || 0;
        winningDamage += pTf.damage || 0;
      }

      for (const idx of losingIndices) {
        const pTf = tf.players && tf.players[idx];
        const evalP = evaluatedPlayers[idx];
        const rawP = matchData.players[idx];
        if (!pTf || !evalP || !rawP) continue;

        const d = pTf.deaths || 0;
        const dmg = pTf.damage || 0;
        losingDeaths += d;
        losingDamage += dmg;
        losingGoldDelta += pTf.gold_delta || 0;

        if (d > 0) {
          deadLosingPlayers.push({ evalP, dmg });
        }

        const heroMeta = HEROES_DB[evalP.hero_id] || {};
        const bigUlt = heroMeta.bigUlt;
        const ultLabel = heroMeta.ultLabel;
        const ultCd = heroMeta.ultCd || 100;
        const abUses = pTf.ability_uses || {};
        const itUses = pTf.item_uses || {};

        const usedUlt = bigUlt ? (abUses[bigUlt] || 0) > 0 : false;
        const prevUltEnd = lastUltEndByIdx[idx] ?? -9999;
        const ultWasOnCooldown = Boolean(bigUlt && prevUltEnd > 0 && (tfStart - prevUltEnd < ultCd) && !usedUlt);
        const ultWasReady = Boolean(bigUlt && (tfStart - prevUltEnd >= ultCd));

        if (ultWasOnCooldown && ultLabel) {
          const remSec = Math.max(5, Math.round(ultCd - (tfStart - prevUltEnd)));
          ultsOnCooldown.push(`${evalP.hero_name} (${ultLabel} в КД ещё ~${remSec}с)`);
        }

        if (usedUlt) {
          lastUltEndByIdx[idx] = tfEnd;
        }

        const bkbBoughtSec = evalP.build_audit ? evalP.build_audit.bkbBoughtAtSec : null;
        const hadBkbAtFight = evalP.items.includes(116) && (bkbBoughtSec !== null ? bkbBoughtSec <= tfStart - 10 : tfStart >= 1500);
        const pressedBkb = (itUses.black_king_bar || 0) > 0;
        const prevBkbEnd = lastBkbEndByIdx[idx] ?? -9999;
        const bkbWasOnCd = hadBkbAtFight && prevBkbEnd > 0 && (tfStart - prevBkbEnd < 85) && !pressedBkb;

        if (bkbWasOnCd && !evalP.isSupport) {
          ultsOnCooldown.push(`${evalP.hero_name} (BKB в КД)`);
        }
        if (pressedBkb) {
          lastBkbEndByIdx[idx] = tfEnd;
        }

        if (!evalP.isSupport && d > 0 && tfStart >= 1140 && !hadBkbAtFight && evalP.build_audit && evalP.build_audit.hasCriticalBuildMistake) {
          coresWithoutBkbInFight.push(
            evalP.build_audit.bkbBoughtAtMin
              ? `${evalP.personaname} (${evalP.hero_name}) дрался без BKB (купит его только на ${evalP.build_audit.bkbBoughtAtMin}-й минуте)`
              : `${evalP.personaname} (${evalP.hero_name}) дрался без BKB против контроля`
          );
        }

        if ((d > 0 || losingDeaths >= 3) && tfStart >= 720) {
          const missedHere = [];
          if (ultWasReady && !usedUlt && ultLabel && (d > 0 || dmg < 1400)) {
            missedHere.push(`ульт ${ultLabel}`);
          }
          if (!evalP.isSupport && hadBkbAtFight && !bkbWasOnCd && !pressedBkb && d > 0 && dmg < 1100) {
            missedHere.push('BKB');
          }
          if (missedHere.length > 0) {
            unpressedReadyButtons.push(`${evalP.personaname} (${evalP.hero_name}) не нажал ${missedHere.join(' + ')}`);
          }
        }

        if ((evalP.position === 1 || evalP.position === 2) && d === 0 && dmg < 250 && tfStart >= 900) {
          absentCores.push(`${evalP.hero_name} (Pos ${evalP.position})`);
        }
      }

      const leadBefore = getLosingTeamGoldLeadAtMin(Math.max(0, tfMin - 1));
      const leadAfter = getLosingTeamGoldLeadAtMin(tfMin + 2);
      const goldSwingAgainstLosing = (leadBefore !== null && leadAfter !== null)
        ? Math.max(0, leadBefore - leadAfter)
        : Math.max(0, (losingDeaths - winningDeaths) * 850);

      analyzedFights.push({
        fIdx,
        tfStart,
        tfEnd,
        timeStr: formatClock(tfStart),
        losingDeaths,
        winningDeaths,
        losingDamage,
        winningDamage,
        leadBefore,
        leadAfter,
        goldSwingAgainstLosing,
        deadLosingPlayers,
        ultsOnCooldown,
        unpressedReadyButtons,
        coresWithoutBkbInFight,
        absentCores
      });
    }

    const midLateFights = analyzedFights.filter(f => f.tfStart >= 900 && f.losingDeaths >= 2);
    let turningFight = null;
    let bestTurningScore = -999999;

    for (const f of midLateFights) {
      const wasCompetitiveBefore = f.leadBefore === null || f.leadBefore >= -4500;
      const hadBlunder = f.unpressedReadyButtons.length > 0 || f.coresWithoutBkbInFight.length > 0;
      const score =
        (f.losingDeaths - f.winningDeaths) * 1000 +
        f.goldSwingAgainstLosing * 0.7 +
        (wasCompetitiveBefore ? 1800 : 0) +
        (hadBlunder ? 2200 : 0);
      if (score > bestTurningScore) {
        bestTurningScore = score;
        turningFight = f;
      }
    }

    const usedFightIndices = new Set();

    if (turningFight) {
      usedFightIndices.add(turningFight.fIdx);
      const beforeContext = turningFight.leadBefore !== null && turningFight.leadBefore >= 1000
        ? `До ${turningFight.timeStr} игра шла отлично (${losingTeamName} вели +${turningFight.leadBefore.toLocaleString('ru-RU')} 🪙)`
        : turningFight.leadBefore !== null && turningFight.leadBefore >= -3000
          ? `До ${turningFight.timeStr} ${losingTeamName} держались в игре на равных`
          : `На ${turningFight.timeStr} ${losingTeamName} пытались вернуться в игру`;

      const blunderNotes = [
        ...turningFight.unpressedReadyButtons,
        ...turningFight.coresWithoutBkbInFight
      ];
      const blunderStr = blunderNotes.length > 0
        ? ` Главная недоигровка в замесе: ${blunderNotes.slice(0, 2).join('; ')}.`
        : ` Погибли: ${turningFight.deadLosingPlayers.map(x => x.evalP.hero_name).join(', ')}.`;

      events.push({
        sortTimeSec: turningFight.tfStart,
        time: turningFight.timeStr,
        tag: '📉 ПЕРЕЛОМНЫЙ ФАЙТ',
        tone: 'critical',
        title: `Точка перелома на ${turningFight.timeStr}: размен ${turningFight.winningDeaths} в ${turningFight.losingDeaths}, после которого игра пошла под откос`,
        description: `${beforeContext}, но в этом замесе команда отдала ${turningFight.losingDeaths} героев.${blunderStr}`,
        pill: `Размен ${turningFight.winningDeaths} в ${turningFight.losingDeaths}${turningFight.goldSwingAgainstLosing >= 1000 ? ` • Минус ~${Math.round(turningFight.goldSwingAgainstLosing / 100) * 100} 🪙` : ''}`
      });
    }

    const cdFight = analyzedFights.find(f =>
      !usedFightIndices.has(f.fIdx) &&
      f.losingDeaths >= 3 &&
      (f.ultsOnCooldown.length > 0 || f.absentCores.length > 0)
    );
    if (cdFight) {
      usedFightIndices.add(cdFight.fIdx);
      const whyBadFight = cdFight.ultsOnCooldown.length > 0
        ? `ключевые кнопки еще были в кулдауне после прошлой стычки (${cdFight.ultsOnCooldown.join(', ')})`
        : `главный кор команды вообще не был рядом (${cdFight.absentCores.join(', ')} фармил другую часть карты)`;

      events.push({
        sortTimeSec: cdFight.tfStart,
        time: cdFight.timeStr,
        tag: '⏳ ДРАКА БЕЗ КНОПКИ (КД)',
        tone: 'warn',
        title: `Приняли файт без главных кнопок на ${cdFight.timeStr} (размен ${cdFight.winningDeaths} в ${cdFight.losingDeaths})`,
        description: `Команда ${losingTeamName} ввязалась в замес, когда ${whyBadFight}. Итог — потеря ${cdFight.losingDeaths} героев.`,
        pill: cdFight.ultsOnCooldown.length > 0 ? `В КД: ${cdFight.ultsOnCooldown[0]}` : `Бой 4v5 без ${cdFight.absentCores[0]}`
      });
    }

    const pointlessFight = analyzedFights.find(f =>
      !usedFightIndices.has(f.fIdx) &&
      f.tfStart >= 720 &&
      f.tfStart <= durationSec - 150 &&
      f.losingDeaths >= 3 &&
      f.winningDeaths <= 1
    );
    if (pointlessFight) {
      usedFightIndices.add(pointlessFight.fIdx);
      const deadNames = pointlessFight.deadLosingPlayers.map(x => `${x.evalP.personaname} (${x.evalP.hero_name})`).join(', ');
      events.push({
        sortTimeSec: pointlessFight.tfStart,
        time: pointlessFight.timeStr,
        tag: '🤡 ФАЙТ НИ ЗА ЧТО',
        tone: 'critical',
        title: `Бессмысленный слив на ${pointlessFight.timeStr}: ${pointlessFight.losingDeaths} игрока пошли и отдались (${pointlessFight.winningDeaths} в ${pointlessFight.losingDeaths})`,
        description: `Файт буквально ни за что: ${deadNames} подставились без позиционки и умерли почти без ответного урона, подарив врагу темп и Рошана/вышки.`,
        pill: `Сухой размен ${pointlessFight.winningDeaths} в ${pointlessFight.losingDeaths}`
      });
    }
  } else {
    const losingPlayers = evaluatedPlayers.filter(p => p.isRadiant === losingIsRadiant);
    const winningPlayers = evaluatedPlayers.filter(p => p.isRadiant !== losingIsRadiant);

    const lowKpCores = losingPlayers.filter(p => !p.isSupport && p.teamfight_participation_pct < 42);
    const highDeathPlayers = [...losingPlayers].sort((a, b) => b.stats.deaths - a.stats.deaths);
    const topFeeder = highDeathPlayers[0];

    if (lowKpCores.length > 0) {
      const names = lowKpCores.map(p => `${p.personaname} (${p.hero_name} — ${p.teamfight_participation_pct}% драк, ${p.damage_per_gold} урон/🪙)`).join(", ");
      events.push({
        sortTimeSec: Math.round(durationSec * 0.45),
        time: formatClock(Math.round(durationSec * 0.45)),
        tag: "🌲 ПАССИВНЫЙ МИДГЕЙМ",
        tone: "warn",
        title: `Потеря темпа в мидгейме: коры ${losingTeamName} выпали из командных драк`,
        description: `Вместо давления по карте ключевые позиции ушли в пассивный фарм: ${names}. Команда дралась в меньшинстве и отдала инициативу.`,
        pill: `Участие в драках < 42%`
      });
    }

    if (topFeeder && topFeeder.stats.deaths >= 9) {
      events.push({
        sortTimeSec: Math.round(durationSec * 0.65),
        time: formatClock(Math.round(durationSec * 0.65)),
        tag: "📉 СЕРИЯ ПОТЕРЬ В ДРАКАХ",
        tone: "critical",
        title: `Провал в командных стычках: ${topFeeder.personaname} (${topFeeder.hero_name}) погибает ${topFeeder.stats.deaths} раз`,
        description: `За счет фрагов на ${topFeeder.hero_name} (счет ${topFeeder.stats.kills}/${topFeeder.stats.deaths}/${topFeeder.stats.assists}) ${winningTeamName} разогнали сноубол по золоту и забрали ключевые объекты карты.`,
        pill: `${topFeeder.stats.deaths} смертей за матч`
      });
    }

    const totalWinTowerDmg = winningPlayers.reduce((s, p) => s + (p.tower_damage || 0), 0);
    const totalLoseTowerDmg = losingPlayers.reduce((s, p) => s + (p.tower_damage || 0), 0);
    if (totalWinTowerDmg > totalLoseTowerDmg * 2 && totalLoseTowerDmg < 3500) {
      events.push({
        sortTimeSec: Math.round(durationSec * 0.82),
        time: formatClock(Math.round(durationSec * 0.82)),
        tag: "🏳️ НОЛЬ ДАВЛЕНИЯ НА БАШНИ",
        tone: "warn",
        title: `Полный провал по строениям от ${losingTeamName} (${totalLoseTowerDmg.toLocaleString("ru-RU")} урона башням)`,
        description: `За всю игру ${losingTeamName} нанесли лишь ${totalLoseTowerDmg.toLocaleString("ru-RU")} урона по вышкам против ${totalWinTowerDmg.toLocaleString("ru-RU")} у ${winningTeamName}, играя без сплит-пуша и захвата карты.`,
        pill: `Башни: ${totalLoseTowerDmg.toLocaleString("ru-RU")} vs ${totalWinTowerDmg.toLocaleString("ru-RU")}`
      });
    }
  }

  for (const p of evaluatedPlayers) {
    if (!p.wonMatch && p.build_audit && p.build_audit.hasCriticalBuildMistake) {
      if (p.build_audit.bkbBoughtAtSec >= 1980) {
        const bkbSec = p.build_audit.bkbBoughtAtSec;
        const bkbTime = p.build_audit.bkbBoughtAtStr;
        const bkbMin = p.build_audit.bkbBoughtAtMin;
        const threats = p.build_audit.enemyControlHeroes.slice(0, 5).join(", ");
        events.push({
          sortTimeSec: bkbSec,
          time: bkbTime,
          tag: "🛠️ ЗАПОЗДАЛЫЙ BKB",
          tone: "critical",
          title: `Только на ${bkbMin}-й минуте (${bkbTime}) ${p.personaname} (${p.hero_name}) покупает BKB!`,
          description: `Против драфта с жестким контролем (${threats}) ${p.hero_name} всю игру собирал голый урон и купил Black King Bar лишь на ${bkbTime}, когда ключевые драки уже были проиграны.`,
          pill: `BKB на ${bkbTime} против ${threats}`
        });
      } else {
        const failedItemChecks = (p.build_audit.counterMatrix || []).filter(c => c.status === "failed");
        const topFailed = failedItemChecks[0];
        if (topFailed) {
          const checkSec = Math.round(durationSec * 0.74);
          events.push({
            sortTimeSec: checkSec,
            time: formatClock(checkSec),
            tag: "🤖 ОШИБКА КОНТР-БИЛДА",
            tone: "critical",
            title: `${p.personaname} (${p.hero_name}): ${p.build_audit.headline}`,
            description: p.build_audit.explanation,
            pill: `${topFailed.category}: ${topFailed.playerResponse.replace(/^✕\s*/, "")}`
          });
        }
      }
    }
  }

  const noBuybackLosers = evaluatedPlayers.filter(p => p.badges.includes('Жертва без байбека'));
  const finalTimeStr = formatClock(durationSec);
  if (noBuybackLosers.length > 0) {
    const names = noBuybackLosers.map(p => `${p.personaname} (${p.hero_name})`).join(', ');
    events.push({
      sortTimeSec: durationSec,
      time: finalTimeStr,
      tag: '🏁 ПАДЕНИЕ ТРОНА',
      tone: 'critical',
      title: `Финальная ошибка без байбека и конец игры (${finalTimeStr})`,
      description: `В решающей защите базы погиб без выкупа: ${names}. ${winningTeamName} заканчивают матч со счетом ${radiantWin ? `${matchData.radiant_score} : ${matchData.dire_score}` : `${matchData.dire_score} : ${matchData.radiant_score}`}.`,
      pill: `Победа ${winningTeamName}`
    });
  } else {
    events.push({
      sortTimeSec: durationSec,
      time: finalTimeStr,
      tag: '🏁 ФИНАЛ МАТЧА',
      tone: 'neutral',
      title: `Падение трона на ${finalTimeStr} (${durationMin} мин)`,
      description: `${winningTeamName} реализовали накопленное преимущество по карте и сломали базу ${losingTeamName}.`,
      pill: `Итог: Победа ${winningTeamName}`
    });
  }

  return events.sort((a, b) => a.sortTimeSec - b.sortTimeSec);
}

function analyzeMatch(matchData) {
  if (!matchData || !Array.isArray(matchData.players) || matchData.players.length === 0) {
    throw new Error('Не удалось получить список игроков матча.');
  }

  const durationSec = matchData.duration || 2400;
  const durationMin = durationSec / 60;
  const radiantWin = Boolean(matchData.radiant_win);
  const teamfights = Array.isArray(matchData.teamfights) ? matchData.teamfights : [];

  const radiantPlayers = matchData.players.filter(p => p.player_slot < 128);
  const direPlayers = matchData.players.filter(p => p.player_slot >= 128);

  const radiantKills = matchData.radiant_score ?? radiantPlayers.reduce((s, p) => s + (p.kills || 0), 0);
  const direKills = matchData.dire_score ?? direPlayers.reduce((s, p) => s + (p.kills || 0), 0);

  const radiantDamage = radiantPlayers.reduce((s, p) => s + (p.hero_damage || 0), 0) || 1;
  const direDamage = direPlayers.reduce((s, p) => s + (p.hero_damage || 0), 0) || 1;

  const ranksAt10 = computeGoldRanksAtMinute(matchData.players, 10);
  const ranksAt20 = computeGoldRanksAtMinute(matchData.players, 20);
  const matchIsParsed = isMatchReplayParsed(matchData.players, teamfights);

  const evaluatedPlayers = matchData.players.map((player, idx) => {
    const isRadiant = player.player_slot < 128;
    return evaluatePlayer(player, idx, {
      durationSec,
      durationMin,
      radiantWin,
      teamKills: isRadiant ? radiantKills : direKills,
      teamDamage: isRadiant ? radiantDamage : direDamage,
      teamPlayers: isRadiant ? radiantPlayers : direPlayers,
      enemyPlayers: isRadiant ? direPlayers : radiantPlayers,
      allPlayers: matchData.players,
      teamfights,
      ranksAt10,
      ranksAt20,
      matchIsParsed
    });
  });

  const rankedByRuin = [...evaluatedPlayers].sort((a, b) => {
    const aSab = a.scores.sabotage >= 55 && a.scores.total >= 50 ? 1 : 0;
    const bSab = b.scores.sabotage >= 55 && b.scores.total >= 50 ? 1 : 0;
    if (bSab !== aSab) return bSab - aSab;
    const aLoserWithFault = !a.wonMatch && a.scores.total >= 12 ? 1 : 0;
    const bLoserWithFault = !b.wonMatch && b.scores.total >= 12 ? 1 : 0;
    if (bLoserWithFault !== aLoserWithFault) return bLoserWithFault - aLoserWithFault;
    if (b.scores.total !== a.scores.total) return b.scores.total - a.scores.total;
    return a.hero_efficiency_percentile - b.hero_efficiency_percentile;
  });

  const explicitSaboteurs = rankedByRuin.filter(p => p.scores.sabotage >= 55 && p.scores.total >= 50);
  const losingTeamCandidates = rankedByRuin.filter(p => !p.wonMatch);

  const topCulprit = explicitSaboteurs[0] || losingTeamCandidates[0] || rankedByRuin[0];
  const remainingCandidates = (explicitSaboteurs.length > 0 ? rankedByRuin : losingTeamCandidates)
    .filter(p => p.player_slot !== topCulprit.player_slot);
  const closeRuiner = remainingCandidates[0] || rankedByRuin.find(p => p.player_slot !== topCulprit.player_slot) || null;
  const scoreGap = closeRuiner ? Math.max(0, topCulprit.scores.total - closeRuiner.scores.total) : topCulprit.scores.total;

  if (topCulprit && topCulprit.scores.total >= 25 && topCulprit.scores.sabotage < 55) {
    topCulprit.ruinType = 'Главный якорь матча';
    topCulprit.verdictTier = 'Главный якорь матча';
  }

  const isExplicit = topCulprit.scores.sabotage >= 55 && topCulprit.scores.total >= 50;
  const hasRealRuiner = topCulprit.scores.total >= 25;

  let goldAdvSeries = Array.isArray(matchData.radiant_gold_adv) && matchData.radiant_gold_adv.length > 1
    ? matchData.radiant_gold_adv
    : [];
  if (goldAdvSeries.length === 0) {
    const maxLen = Math.max(0, ...matchData.players.map(p => Array.isArray(p.gold_t) ? p.gold_t.length : 0));
    if (maxLen > 1) {
      goldAdvSeries = Array.from({ length: maxLen }, (_, mIdx) => {
        let rG = 0, dG = 0;
        for (const p of matchData.players) {
          const val = (Array.isArray(p.gold_t) && p.gold_t[Math.min(mIdx, p.gold_t.length - 1)]) || 0;
          if (p.player_slot < 128) rG += val;
          else dG += val;
        }
        return rG - dG;
      });
    }
  }

  // Honorable Mention: информация о статусе парсинга реплея в OpenDota
  const parseStatusInfo = {
    is_parsed: matchIsParsed,
    can_request_parse: !matchIsParsed && Boolean(matchData.match_id),
    request_endpoint: matchData.match_id ? `https://api.opendota.com/api/request/${matchData.match_id}` : null,
    warning_title: matchIsParsed
      ? '✓ Полный разбор реплея (OpenDota Parsed)'
      : '⚠ Матч не распарсен в OpenDota (доступна только базовая стата)',
    warning_text: matchIsParsed
      ? 'Доступны поминутные логи покупок, точные координаты вардов и нажатия всех кнопок в тимфайтах.'
      : 'В нераспарсенных матчах отсутствуют логи тимфайтов (combat_log), точное время нажатия кнопок/BKB и лог установки вардов, поэтому сложнее со 100% точностью определить виновника в микро-моментах. Нажмите «Запросить парсинг реплея», чтобы OpenDota обработал запись матча.'
  };

  return {
    match_id: matchData.match_id,
    is_parsed: matchIsParsed,
    parse_status: parseStatusInfo,
    duration_sec: durationSec,
    radiant_gold_adv: goldAdvSeries,
    duration_formatted: formatClock(durationSec),
    radiant_win: radiantWin,
    radiant_score: radiantKills,
    dire_score: direKills,
    verdict: {
      hasRuiner: hasRealRuiner,
      classification: isExplicit
        ? 'ЯВНЫЙ РУИН И САБОТАЖ'
        : hasRealRuiner
          ? 'ГЛАВНЫЙ ЯКОРЬ МАТЧА'
          : 'ЧИСТАЯ ИГРА БЕЗ РУИНА',
      headline: isExplicit
        ? `Главный руинер: ${topCulprit.personaname} (${topCulprit.hero_name})`
        : hasRealRuiner
          ? `Главный якорь: ${topCulprit.personaname} (${topCulprit.hero_name})`
          : `Явных руинеров нет (${topCulprit.personaname} — ${topCulprit.scores.total}/100)`,
      confidence: topCulprit.confidence,
      score_gap: scoreGap,
      culprit: topCulprit,
      close_ruiner: closeRuiner
    },
    chronology: buildMatchChronology(matchData, evaluatedPlayers),
    players: evaluatedPlayers,
    leaderboard: rankedByRuin
  };
}

const DEMO_MATCHES = {
  '9041259372': {
    match_id: 9041259372,
    duration: 2694,
    radiant_win: false,
    radiant_score: 40,
    dire_score: 53,
    radiant_gold_adv: [
      0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2600, 2800,
      3100, 3400, 3200, 2900, 2500, 2200, 1900, 1500, 1200, 900,
      600, 400, -1200, -2400, -3100, -3500, -7200, -9400, -11200, -13500,
      -15000, -16800, -18500, -20100, -22400, -24800
    ],
    teamfights: [
      {
        start: 1180, end: 1215, last_death: 1210,
        players: [
          { deaths: 0, damage: 1950, kills: 1, assists: 2, ability_uses: { invoker_deafening_blast: 1 }, item_uses: {} },
          { deaths: 0, damage: 1200, kills: 0, assists: 3, ability_uses: { disruptor_static_storm: 1 }, item_uses: {} },
          { deaths: 0, damage: 2100, kills: 1, assists: 2, ability_uses: { spirit_breaker_nether_strike: 1 }, item_uses: {} },
          { deaths: 0, damage: 3400, kills: 2, assists: 1, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 2200, kills: 0, assists: 3, ability_uses: { mars_arena_of_blood: 1 }, item_uses: { blink: 1 } },
          { deaths: 1, damage: 2100, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 1900, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 1700, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 1100, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 900, ability_uses: {}, item_uses: {} }
        ]
      },
      {
        start: 1250, end: 1285, last_death: 1280,
        players: [
          { deaths: 1, damage: 620, kills: 0, assists: 0, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 540, kills: 0, assists: 0, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 810, kills: 0, assists: 0, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 0, kills: 0, assists: 0, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 920, kills: 0, assists: 0, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 3800, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 3400, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 2500, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 1600, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 1400, ability_uses: {}, item_uses: {} }
        ]
      },
      {
        start: 1620, end: 1665, last_death: 1660,
        players: [
          { deaths: 1, damage: 320, kills: 0, assists: 0, ability_uses: {}, item_uses: { black_king_bar: 0 } },
          { deaths: 1, damage: 1100, kills: 0, assists: 1, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 4120, kills: 0, assists: 3, ability_uses: { spirit_breaker_nether_strike: 1 }, item_uses: { black_king_bar: 1 } },
          { deaths: 1, damage: 1850, kills: 1, assists: 0, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 1900, kills: 0, assists: 1, ability_uses: { mars_arena_of_blood: 1 }, item_uses: { blink: 1, pipe: 1 } },
          { deaths: 0, damage: 4200, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 3800, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 2900, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 1800, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 1500, ability_uses: {}, item_uses: {} }
        ]
      },
      {
        start: 2100, end: 2145, last_death: 2140,
        players: [
          { deaths: 1, damage: 410, kills: 0, assists: 0, ability_uses: {}, item_uses: { black_king_bar: 0 } },
          { deaths: 1, damage: 950, kills: 0, assists: 1, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 3850, kills: 0, assists: 2, ability_uses: { spirit_breaker_nether_strike: 1 }, item_uses: { black_king_bar: 1 } },
          { deaths: 0, damage: 2400, kills: 1, assists: 1, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 2200, kills: 0, assists: 1, ability_uses: { mars_arena_of_blood: 1 }, item_uses: { blink: 1, pipe: 1 } },
          { deaths: 0, damage: 5100, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 4600, ability_uses: {}, item_uses: {} },
          { deaths: 1, damage: 3400, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 2100, ability_uses: {}, item_uses: {} },
          { deaths: 0, damage: 1600, ability_uses: {}, item_uses: {} }
        ]
      }
    ],
    players: [
      {
        player_slot: 0, personaname: 'NiKel', hero_id: 74, lane_role: 2,
        kills: 5, deaths: 12, assists: 6, last_hits: 240, neutral_kills: 150,
        gold_per_min: 460, xp_per_min: 560, total_gold: 20650, net_worth: 16100, gold: 4900,
        hero_damage: 14500, tower_damage: 420, obs_placed: 0, sen_placed: 0,
        item_0: 65, item_1: 108, item_2: 116, item_3: 48, item_4: 1, item_5: 0,
        rank_10_min: 2, rank_20_min: 6,
        deaths_log: [{ time: 540 }, { time: 1640 }, { time: 2125 }, { time: 2645 }],
        buyback_count: 0, buyback_log: [],
        purchase_log: [{ time: 510, key: 'hand_of_midas' }, { time: 980, key: 'travel_boots' }, { time: 1340, key: 'blink' }, { time: 1690, key: 'ultimate_scepter' }, { time: 2320, key: 'black_king_bar' }],
        ability_uses: { invoker_deafening_blast: 2 },
        item_uses: { black_king_bar: 0 },
        teamfight_participation: 0.28,
        benchmarks: { gold_per_min: { pct: 0.22 }, xp_per_min: { pct: 0.24 }, hero_damage_per_min: { pct: 0.15 }, tower_damage: { pct: 0.12 } }
      },
      {
        player_slot: 1, personaname: 'The Pope', hero_id: 87, lane_role: 1,
        kills: 3, deaths: 10, assists: 22, last_hits: 45, neutral_kills: 6,
        gold_per_min: 295, xp_per_min: 440, total_gold: 13240, net_worth: 10400, gold: 800,
        hero_damage: 13200, tower_damage: 410, obs_placed: 14, sen_placed: 18, camps_stacked: 4,
        item_0: 180, item_1: 254, item_2: 108, item_3: 102, item_4: 0, item_5: 0,
        rank_10_min: 9, rank_20_min: 9,
        deaths_log: [{ time: 620 }, { time: 1650 }, { time: 2130 }],
        buyback_count: 0, buyback_log: [],
        purchase_log: [{ time: 1100, key: 'glimmer_cape' }],
        ability_uses: { disruptor_static_storm: 7 },
        item_uses: { glimmer_cape: 9, force_staff: 6 },
        teamfight_participation: 0.63,
        benchmarks: { gold_per_min: { pct: 0.52 }, xp_per_min: { pct: 0.54 }, hero_damage_per_min: { pct: 0.58 }, stuns_per_min: { pct: 0.65 } }
      },
      {
        player_slot: 2, personaname: 'swap commends', hero_id: 71, lane_role: 3,
        kills: 2, deaths: 11, assists: 21, last_hits: 95, neutral_kills: 20,
        gold_per_min: 365, xp_per_min: 510, total_gold: 16380, net_worth: 13600, gold: 600,
        hero_damage: 28500, tower_damage: 820, obs_placed: 6, sen_placed: 9, camps_stacked: 3,
        item_0: 63, item_1: 127, item_2: 116, item_3: 244, item_4: 0, item_5: 0,
        rank_10_min: 7, rank_20_min: 7,
        deaths_log: [{ time: 490 }, { time: 1655 }, { time: 2135 }],
        buyback_count: 1, buyback_log: [{ time: 2140 }],
        purchase_log: [{ time: 1400, key: 'black_king_bar' }],
        ability_uses: { spirit_breaker_nether_strike: 9 },
        item_uses: { black_king_bar: 6 },
        teamfight_participation: 0.58,
        benchmarks: { gold_per_min: { pct: 0.58 }, xp_per_min: { pct: 0.60 }, hero_damage_per_min: { pct: 0.82 }, stuns_per_min: { pct: 0.85 } }
      },
      {
        player_slot: 3, personaname: 'Radiant_Carry_PA', hero_id: 44, lane_role: 1,
        kills: 18, deaths: 7, assists: 11, last_hits: 340, neutral_kills: 110,
        gold_per_min: 585, xp_per_min: 690, total_gold: 26260, net_worth: 22900, gold: 900,
        hero_damage: 34100, tower_damage: 4200, obs_placed: 0, sen_placed: 1,
        item_0: 145, item_1: 116, item_2: 168, item_3: 63, item_4: 208, item_5: 135,
        rank_10_min: 3, rank_20_min: 3,
        deaths_log: [{ time: 810 }, { time: 1645 }],
        buyback_count: 1, buyback_log: [{ time: 2140 }],
        purchase_log: [{ time: 890, key: 'bfury' }, { time: 1350, key: 'desolator' }, { time: 1580, key: 'black_king_bar' }],
        teamfight_participation: 0.73,
        benchmarks: { gold_per_min: { pct: 0.72 }, xp_per_min: { pct: 0.74 }, hero_damage_per_min: { pct: 0.75 }, tower_damage: { pct: 0.68 } }
      },
      {
        player_slot: 4, personaname: 'Offlane_Mars_Pro', hero_id: 129, lane_role: 3,
        kills: 12, deaths: 8, assists: 16, last_hits: 215, neutral_kills: 45,
        gold_per_min: 480, xp_per_min: 610, total_gold: 21550, net_worth: 18900, gold: 800,
        hero_damage: 26800, tower_damage: 2150, obs_placed: 1, sen_placed: 3,
        item_0: 1, item_1: 116, item_2: 50, item_3: 90, item_4: 168, item_5: 0,
        rank_10_min: 5, rank_20_min: 4,
        deaths_log: [{ time: 720 }, { time: 2135 }],
        buyback_count: 1, buyback_log: [{ time: 2142 }],
        purchase_log: [{ time: 720, key: 'blink' }, { time: 1310, key: 'pipe' }, { time: 1620, key: 'black_king_bar' }],
        ability_uses: { mars_arena_of_blood: 8 },
        item_uses: { blink: 14, pipe: 6, black_king_bar: 5 },
        teamfight_participation: 0.70,
        benchmarks: { gold_per_min: { pct: 0.68 }, xp_per_min: { pct: 0.69 }, hero_damage_per_min: { pct: 0.71 }, tower_damage: { pct: 0.58 } }
      },
      {
        player_slot: 128, personaname: 'Deep dark fantasy', hero_id: 76, lane_role: 2,
        kills: 14, deaths: 7, assists: 15, last_hits: 280, neutral_kills: 59,
        gold_per_min: 595, xp_per_min: 720, total_gold: 26700, net_worth: 24500, gold: 1850,
        hero_damage: 40300, tower_damage: 5100, obs_placed: 1, sen_placed: 2,
        item_0: 263, item_1: 116, item_2: 96, item_3: 63, item_4: 1, item_5: 0,
        rank_10_min: 1, rank_20_min: 2,
        purchase_log: [{ time: 1320, key: 'black_king_bar' }],
        ability_uses: { obsidian_destroyer_sanity_eclipse: 7 },
        teamfight_participation: 0.55,
        benchmarks: { gold_per_min: { pct: 0.78 }, xp_per_min: { pct: 0.80 }, hero_damage_per_min: { pct: 0.84 }, tower_damage: { pct: 0.76 } }
      },
      {
        player_slot: 129, personaname: 'Dire_Juggernaut', hero_id: 8, lane_role: 1,
        kills: 16, deaths: 5, assists: 18, last_hits: 365, neutral_kills: 110,
        gold_per_min: 670, xp_per_min: 790, total_gold: 30080, net_worth: 28400, gold: 2100,
        hero_damage: 39200, tower_damage: 11200, obs_placed: 0, sen_placed: 2,
        item_0: 145, item_1: 147, item_2: 158, item_3: 50, item_4: 139, item_5: 208,
        rank_10_min: 4, rank_20_min: 1,
        purchase_log: [{ time: 860, key: 'bfury' }, { time: 1290, key: 'manta' }],
        ability_uses: { juggernaut_omni_slash: 9 },
        teamfight_participation: 0.64,
        benchmarks: { gold_per_min: { pct: 0.88 }, xp_per_min: { pct: 0.89 }, hero_damage_per_min: { pct: 0.85 }, tower_damage: { pct: 0.94 } }
      },
      {
        player_slot: 130, personaname: 'Dire_Centaur', hero_id: 96, lane_role: 3,
        kills: 8, deaths: 9, assists: 26, last_hits: 210, neutral_kills: 50,
        gold_per_min: 490, xp_per_min: 640, total_gold: 22000, net_worth: 20100, gold: 1200,
        hero_damage: 26400, tower_damage: 4800, obs_placed: 1, sen_placed: 2,
        item_0: 1, item_1: 127, item_2: 90, item_3: 214, item_4: 114, item_5: 242,
        rank_10_min: 6, rank_20_min: 5,
        purchase_log: [{ time: 710, key: 'blink' }, { time: 1280, key: 'pipe' }],
        ability_uses: { centaur_stampede: 10 },
        teamfight_participation: 0.64,
        benchmarks: { gold_per_min: { pct: 0.72 }, xp_per_min: { pct: 0.74 }, hero_damage_per_min: { pct: 0.71 }, tower_damage: { pct: 0.75 } }
      },
      {
        player_slot: 131, personaname: 'Dire_Rubick_Pos4', hero_id: 86, lane_role: 3,
        kills: 9, deaths: 9, assists: 28, last_hits: 75, neutral_kills: 12,
        gold_per_min: 380, xp_per_min: 560, total_gold: 17060, net_worth: 15200, gold: 950,
        hero_damage: 21200, tower_damage: 1400, obs_placed: 8, sen_placed: 12, camps_stacked: 3,
        item_0: 1, item_1: 180, item_2: 232, item_3: 102, item_4: 254, item_5: 0,
        rank_10_min: 8, rank_20_min: 8,
        purchase_log: [{ time: 890, key: 'blink' }],
        teamfight_participation: 0.70,
        benchmarks: { gold_per_min: { pct: 0.70 }, xp_per_min: { pct: 0.68 }, hero_damage_per_min: { pct: 0.72 }, stuns_per_min: { pct: 0.80 } }
      },
      {
        player_slot: 132, personaname: 'Dire_WitchDoctor', hero_id: 30, lane_role: 1,
        kills: 6, deaths: 10, assists: 31, last_hits: 48, neutral_kills: 6,
        gold_per_min: 345, xp_per_min: 520, total_gold: 15490, net_worth: 13400, gold: 600,
        hero_damage: 18900, tower_damage: 1650, hero_healing: 6400, obs_placed: 15, sen_placed: 22, camps_stacked: 5,
        item_0: 180, item_1: 254, item_2: 108, item_3: 36, item_4: 0, item_5: 0,
        rank_10_min: 10, rank_20_min: 10,
        ability_uses: { witch_doctor_death_ward: 9 },
        teamfight_participation: 0.70,
        benchmarks: { gold_per_min: { pct: 0.66 }, xp_per_min: { pct: 0.64 }, hero_damage_per_min: { pct: 0.69 }, hero_healing_per_min: { pct: 0.82 } }
      }
    ]
  }
};

async function analyzeMatchWithLlm(matchData, options = {}) {
  if (matchData && matchData.match_id && (!isMatchReplayParsed(matchData.players, matchData.teamfights) || options.enrichWithStratz !== false)) {
    try {
      matchData = await fetchStratzMatchAndEnrich(matchData.match_id, matchData, options);
    } catch (_) {}
  }
  if (matchData && Array.isArray(matchData.players)) {
    await syncDotaConstantsAndMeta(matchData.players, options);
  }
  const result = analyzeMatch(matchData);

  const hasApiKey = Boolean(
    options.apiKey ||
    (typeof process !== "undefined" && process.env && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY))
  );

  if (hasApiKey && Array.isArray(result.players)) {
    const coreTargets = result.players.filter(p => !p.isSupport || p.player_slot === result.verdict.culprit.player_slot);
    await Promise.allSettled(
      coreTargets.map(async (p) => {
        if (!p.build_audit || !p.build_audit.llmPayload) return;
        const llmVerdict = await requestLlmBuildVerdict(p.build_audit.llmPayload, options);
        if (llmVerdict && llmVerdict.headline && llmVerdict.explanation) {
          p.build_audit.verdictStatus = llmVerdict.verdictStatus || p.build_audit.verdictStatus;
          p.build_audit.headline = llmVerdict.headline;
          p.build_audit.explanation = llmVerdict.explanation;
          p.build_audit.llmGenerated = true;
        }
      })
    );
  }

  return result;
}

module.exports = {
  HEROES_DB,
  ABILITIES_DB,
  ITEMS_DB,
  HERO_ITEM_POPULARITY_CACHE,
  INNATE_SPELL_IMMUNITY_OR_ELUSIVE_HERO_IDS,
  META_DISPEL_OR_SAVE_ITEM_IDS,
  BKB_DEPENDENT_STRIKER_HERO_IDS,
  ITEM_TIMING_BENCHMARKS,
  CRITICAL_ACTIVE_ITEMS,
  DEMO_MATCHES,
  registerOpenDotaItemsConstants,
  registerOpenDotaHeroesAndAbilities,
  registerHeroItemPopularity,
  getHeroMetaProfile,
  isBkbPopularForHero,
  DEFAULT_STRATZ_API_TOKEN,
  fetchStratzGraphQL,
  fetchStratzMatchAndEnrich,
  syncDotaConstantsAndMeta,
  requestOpenDotaMatchParse,
  buildLlmAuditPayload,
  requestLlmBuildVerdict,
  inferTeamRoles,
  detectRole,
  auditInventory,
  detectPlayerBuildArchetype,
  analyzeEnemyTargetThreats,
  evaluateBuildAndTimings,
  buildMatchChronology,
  analyzeTeamfightImpact,
  evaluatePlayer,
  analyzeMatch,
  analyzeMatchWithLlm
};