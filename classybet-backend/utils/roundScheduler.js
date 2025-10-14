const crypto = require('crypto');
const RoundSchedule = require('../models/RoundSchedule');

const ROUND_INTERVAL_SECONDS = parseInt(process.env.ROUND_INTERVAL_SECONDS || '30', 10);
const ROUND_DURATION_MS = ROUND_INTERVAL_SECONDS * 1000;
const ROUND_LOOKAHEAD = parseInt(process.env.ROUND_LOOKAHEAD || '240', 10); // number of future rounds to keep
const ROUND_BASE_ID = parseInt(process.env.ROUND_BASE_ID || '100000', 10);
const ROUND_BASE_EPOCH_MS = parseInt(
  process.env.ROUND_BASE_EPOCH_MS || Date.UTC(2025, 0, 1, 0, 0, 0),
  10
);
const ROUND_SALT = process.env.ROUND_SALT || 'aviator-round-salt';
const POPULATE_INTERVAL_MS = Math.max(
  parseInt(process.env.ROUND_POPULATE_INTERVAL_MS || '15000', 10),
  5000
);

function alignToInterval(date) {
  const timestamp = date.getTime();
  const remainder = (timestamp - ROUND_BASE_EPOCH_MS) % ROUND_DURATION_MS;
  const aligned = remainder < 0 ? timestamp : timestamp - remainder;
  return new Date(aligned);
}

function computeRoundOffset(startTime) {
  const diff = startTime.getTime() - ROUND_BASE_EPOCH_MS;
  return Math.max(0, Math.floor(diff / ROUND_DURATION_MS));
}

function computeRoundId(startTime) {
  return ROUND_BASE_ID + computeRoundOffset(startTime);
}

function generateMultiplier(roundId, startTime) {
  const seed = `${ROUND_SALT}:${roundId}:${startTime.toISOString()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  
  // Use first 8 chars for random value (0-1)
  const intVal = parseInt(hash.substring(0, 8), 16);
  const random = (intVal % 100000) / 100000; // 0.00000 - 0.99999
  
  // Distribution: MOSTLY LOW MULTIPLIERS
  // 80% -> 1.00x - 1.99x (very low)
  // 12% -> 2.00x - 4.99x (low-medium)
  // 6%  -> 5.00x - 9.99x (medium)
  // 2%  -> 10.00x - 100.00x (high)
  
  let multiplier;
  
  if (random < 0.80) {
    // 80% chance: 1.00x - 1.99x (VERY LOW)
    const range = 0.99; // 1.99 - 1.00
    multiplier = 1.00 + (random / 0.80) * range;
  } else if (random < 0.92) {
    // 12% chance: 2.00x - 4.99x (LOW-MEDIUM)
    const range = 2.99; // 4.99 - 2.00
    const normalized = (random - 0.80) / 0.12;
    multiplier = 2.00 + normalized * range;
  } else if (random < 0.98) {
    // 6% chance: 5.00x - 9.99x (MEDIUM)
    const range = 4.99; // 9.99 - 5.00
    const normalized = (random - 0.92) / 0.06;
    multiplier = 5.00 + normalized * range;
  } else {
    // 2% chance: 10.00x - 100.00x (HIGH)
    const range = 90.00; // 100.00 - 10.00
    const normalized = (random - 0.98) / 0.02;
    multiplier = 10.00 + normalized * range;
  }
  
  return Number(multiplier.toFixed(2));
}

async function populateRoundSchedule() {
  try {
    const now = new Date();
    const alignedStart = alignToInterval(now);
    const targetEndTime = new Date(alignedStart.getTime() + ROUND_LOOKAHEAD * ROUND_DURATION_MS);

    const existing = await RoundSchedule.find({
      startTime: { $gte: alignedStart, $lte: targetEndTime }
    }).select('roundId').lean();

    const existingIds = new Set(existing.map((r) => r.roundId));
    const bulkOps = [];

    for (
      let cursor = alignedStart;
      cursor <= targetEndTime;
      cursor = new Date(cursor.getTime() + ROUND_DURATION_MS)
    ) {
      const roundId = computeRoundId(cursor);
      if (existingIds.has(roundId)) {
        continue;
      }

      const multiplier = generateMultiplier(roundId, cursor);
      bulkOps.push({
        updateOne: {
          filter: { roundId },
          update: {
            $set: {
              roundId,
              startTime: cursor,
              multiplier,
              status: 'pending'
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      const result = await RoundSchedule.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Populated ${bulkOps.length} rounds (${result.upsertedCount} new, ${result.modifiedCount} updated)`);
      return bulkOps.length;
    }
    
    return 0;
  } catch (error) {
    console.error('❌ Error populating rounds:', error.message);
    throw error;
  }
}

async function getRoundState(limit = 10) {
  const now = new Date();
  const lookaheadLimit = Math.min(Math.max(limit, 1), 50);

  await populateRoundSchedule();

  const currentRound = await RoundSchedule.findOne({ startTime: { $lte: now } })
    .sort({ startTime: -1 })
    .lean();

  const nextRounds = await RoundSchedule.find({ startTime: { $gt: now } })
    .sort({ startTime: 1 })
    .limit(lookaheadLimit + 1)
    .lean();

  const nextRound = nextRounds.length > 0 ? nextRounds[0] : null;
  const upcoming = nextRounds.slice(1, 1 + lookaheadLimit);

  if (currentRound) {
    const elapsed = now.getTime() - new Date(currentRound.startTime).getTime();
    if (elapsed >= ROUND_DURATION_MS && currentRound.status !== 'complete') {
      RoundSchedule.updateOne({ roundId: currentRound.roundId }, { status: 'complete' }).catch(() => {});
    } else if (elapsed < ROUND_DURATION_MS && currentRound.status !== 'running') {
      RoundSchedule.updateOne({ roundId: currentRound.roundId }, { status: 'running' }).catch(() => {});
    }
  }

  return { currentRound, nextRound, upcoming };
}

async function getRoundById(roundId) {
  const numericId = Number(roundId);
  if (Number.isNaN(numericId)) {
    return null;
  }
  return RoundSchedule.findOne({ roundId: numericId }).lean();
}

async function getRoundsInRange(from, to, limit = 200) {
  const query = {};
  if (from || to) {
    query.startTime = {};
    if (from) {
      query.startTime.$gte = from;
    }
    if (to) {
      query.startTime.$lte = to;
    }
  }

  return RoundSchedule.find(query)
    .sort({ startTime: 1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .lean();
}

function startRoundScheduler() {
  populateRoundSchedule().catch((error) => {
    console.error('Round scheduler initial populate failed:', error.message);
  });

  setInterval(() => {
    populateRoundSchedule().catch((error) => {
      console.error('Round scheduler populate failed:', error.message);
    });
  }, POPULATE_INTERVAL_MS);
}

module.exports = {
  ROUND_INTERVAL_SECONDS,
  ROUND_DURATION_MS,
  populateRoundSchedule,
  getRoundState,
  getRoundById,
  getRoundsInRange,
  startRoundScheduler,
  computeRoundId
};
