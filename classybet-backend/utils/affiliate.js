const mongoose = require('mongoose');
const User = require('../models/User');
const Referral = require('../models/Referral');

const DEFAULT_COMMISSION_RATE = 0.5;

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (error) {
    return null;
  }
};

const normalizePromoCode = (promoCode) => {
  if (typeof promoCode !== 'string') {
    return '';
  }
  return promoCode.trim().toUpperCase();
};

const ensureAffiliateStats = (affiliate) => {
  if (!affiliate.affiliateStats) {
    affiliate.affiliateStats = {};
  }

  affiliate.affiliateStats.referredUsers = affiliate.affiliateStats.referredUsers || 0;
  affiliate.affiliateStats.totalDeposits = affiliate.affiliateStats.totalDeposits || 0;
  affiliate.affiliateStats.totalLosses = affiliate.affiliateStats.totalLosses || 0;
  affiliate.affiliateStats.affiliateBalance = affiliate.affiliateStats.affiliateBalance || 0;
  affiliate.affiliateStats.pendingPayout = affiliate.affiliateStats.pendingPayout || 0;
  affiliate.affiliateStats.lastPayoutAt = affiliate.affiliateStats.lastPayoutAt || null;
};

const findAffiliateByPromoCode = async (promoCode) => {
  const normalized = normalizePromoCode(promoCode);
  if (!normalized) {
    return null;
  }

  return await User.findOne({ promoCode: normalized, isAffiliate: true });
};

const applyPromoCodeToUser = async (user, promoCode, options = {}) => {
  const normalized = normalizePromoCode(promoCode);
  if (!normalized) {
    return { success: false, status: 400, message: 'Promo code is required.' };
  }

  if (user.referredBy) {
    return { success: false, status: 400, message: 'Promo code already applied.' };
  }

  const affiliate = await findAffiliateByPromoCode(normalized);
  if (!affiliate) {
    return { success: false, status: 404, message: 'Promo code not found.' };
  }

  if (affiliate._id.equals(user._id)) {
    return { success: false, status: 400, message: 'You cannot use your own promo code.' };
  }

  const existingReferral = await Referral.findOne({ referredUser: user._id });
  if (existingReferral) {
    return { success: false, status: 400, message: 'Referral already linked.' };
  }

  user.referredBy = affiliate._id;
  await user.save();

  const referral = new Referral({
    affiliate: affiliate._id,
    referredUser: user._id,
    promoCodeUsed: normalized,
    referralLink: options.referralLink || null,
    commissionRate: options.commissionRate || DEFAULT_COMMISSION_RATE
  });
  await referral.save();

  ensureAffiliateStats(affiliate);
  affiliate.affiliateStats.referredUsers += 1;
  affiliate.markModified('affiliateStats');
  await affiliate.save();

  return { success: true, status: 200, affiliate, referral };
};

const recordAffiliateDeposit = async (user, amount) => {
  if (!user || !user._id || amount <= 0) {
    return;
  }

  const referral = await Referral.findOne({ referredUser: user._id });
  if (!referral) {
    return;
  }

  referral.depositTotal += amount;
  referral.markModified('metadata');
  await referral.save();

  const affiliate = await User.findById(referral.affiliate);
  if (!affiliate || !affiliate.isAffiliate) {
    return;
  }

  ensureAffiliateStats(affiliate);
  affiliate.affiliateStats.totalDeposits += amount;
  affiliate.markModified('affiliateStats');
  await affiliate.save();
};

const recordAffiliateLoss = async (user, amount) => {
  if (!user || !user._id || amount <= 0) {
    return;
  }

  const referral = await Referral.findOne({ referredUser: user._id });
  if (!referral) {
    return;
  }

  const commissionRate = referral.commissionRate || DEFAULT_COMMISSION_RATE;
  const commission = amount * commissionRate;

  referral.lossTotal += amount;
  referral.commissionEarned += commission;
  referral.lastCommissionAt = new Date();
  await referral.save();

  const affiliate = await User.findById(referral.affiliate);
  if (!affiliate || !affiliate.isAffiliate) {
    return;
  }

  ensureAffiliateStats(affiliate);
  affiliate.affiliateStats.totalLosses += amount;
  affiliate.affiliateStats.affiliateBalance += commission;
  affiliate.affiliateStats.pendingPayout += commission;
  affiliate.markModified('affiliateStats');
  await affiliate.save();
};

module.exports = {
  DEFAULT_COMMISSION_RATE,
  normalizePromoCode,
  ensureAffiliateStats,
  findAffiliateByPromoCode,
  applyPromoCodeToUser,
  recordAffiliateDeposit,
  recordAffiliateLoss,
  toObjectId
};
