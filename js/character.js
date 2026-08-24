// character.js — renders the RPG character as inline SVG.
// The silhouette itself gets visibly more built at level tiers; equipped
// shop items layer on top as emoji so the shop purchases are visible.

function tierForLevel(level) {
  if (level >= 12) return 3; // jacked
  if (level >= 6) return 2;  // defined
  return 1;                  // lean
}

const TIER_BUILD = {
  1: { shoulderW: 44, armW: 9, chestH: 30, color: '#7C8A9E' },
  2: { shoulderW: 54, armW: 12, chestH: 34, color: '#3FA796' },
  3: { shoulderW: 64, armW: 16, chestH: 38, color: '#E8952C' },
};

function renderCharacter({ level, equipped }) {
  const tier = tierForLevel(level);
  const b = TIER_BUILD[tier];
  const hat = equipped.find(i => i.category === 'hat');
  const outfit = equipped.find(i => i.category === 'outfit');
  const pet = equipped.find(i => i.category === 'pet');
  const accessory = equipped.find(i => i.category === 'accessory');
  const outfitColor = outfit ? '#E8952C' : b.color;

  return `
  <svg viewBox="0 0 220 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Character, level ${level}">
    <circle cx="110" cy="60" r="30" fill="#EFC9A0"/>
    ${hat ? `<text x="110" y="38" font-size="34" text-anchor="middle">${hat.emoji}</text>` : ''}
    <rect x="${110 - b.shoulderW / 2}" y="90" width="${b.shoulderW}" height="${b.chestH}" rx="16" fill="${outfitColor}"/>
    <rect x="${110 - b.shoulderW / 2 - b.armW}" y="94" width="${b.armW}" height="${b.chestH + 10}" rx="6" fill="#EFC9A0"/>
    <rect x="${110 + b.shoulderW / 2}" y="94" width="${b.armW}" height="${b.chestH + 10}" rx="6" fill="#EFC9A0"/>
    <rect x="92" y="${90 + b.chestH}" width="18" height="60" rx="8" fill="#2B2F38"/>
    <rect x="110" y="${90 + b.chestH}" width="18" height="60" rx="8" fill="#2B2F38"/>
    ${accessory ? `<text x="110" y="${90 + b.chestH - 6}" font-size="18" text-anchor="middle">${accessory.emoji}</text>` : ''}
    ${pet ? `<text x="185" y="230" font-size="30" text-anchor="middle">${pet.emoji}</text>` : ''}
  </svg>`;
}

window.LevelUpCharacter = { renderCharacter, tierForLevel };
