const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { connectToMongoDB } = require('../utils/database');
const User = require('../models/User');
const Referral = require('../models/Referral');
const {
  normalizePromoCode,
  applyPromoCodeToUser,
  ensureAffiliateStats
} = require('../utils/affiliate');

const router = express.Router();

const affiliateCodeValidator = body('promoCode')
  .notEmpty().withMessage('Promo code is required')
  .isLength({ min: 4, max: 12 }).withMessage('Promo code must be 4-12 characters long')
  .matches(/^[A-Za-z0-9]+$/).withMessage('Promo code can only contain letters and numbers');

const requireAffiliate = async (req, res, next) => {
  try {
    await connectToMongoDB();

    const affiliate = await User.findById(req.userId);
    if (!affiliate || !affiliate.isAffiliate) {
      return res.status(403).json({ error: 'Affiliate access required.' });
    }

    ensureAffiliateStats(affiliate);
    req.affiliate = affiliate;
    next();
  } catch (error) {
    console.error('Affiliate guard error:', error);
    res.status(500).json({ error: 'Failed to verify affiliate status.' });
  }
};

router.post(
  '/join',
  authenticateToken,
  [affiliateCodeValidator],
  async (req, res) => {
    try {
      await connectToMongoDB();

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const normalizedPromo = normalizePromoCode(req.body.promoCode);
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (user.isAffiliate) {
        return res.status(400).json({ error: 'Already enrolled in affiliate program.' });
      }

      const promoTaken = await User.exists({ promoCode: normalizedPromo });
      if (promoTaken) {
        return res.status(400).json({ error: 'Promo code already in use.' });
      }

      ensureAffiliateStats(user);
      user.isAffiliate = true;
      user.promoCode = normalizedPromo;
      user.markModified('affiliateStats');
      await user.save();

      res.json({
        message: 'Affiliate program joined successfully.',
        affiliate: user.getPublicProfile()
      });
    } catch (error) {
      console.error('Join affiliate error:', error);
      res.status(500).json({ error: 'Failed to join affiliate program.' });
    }
  }
);

router.post(
  '/apply-code',
  authenticateToken,
  [affiliateCodeValidator],
  async (req, res) => {
    try {
      await connectToMongoDB();

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const result = await applyPromoCodeToUser(user, req.body.promoCode);
      if (!result.success) {
        return res.status(result.status || 400).json({ error: result.message });
      }

      res.json({
        message: 'Promo code applied successfully.',
        affiliate: result.affiliate.getPublicProfile(),
        referral: result.referral
      });
    } catch (error) {
      console.error('Apply promo code error:', error);
      res.status(500).json({ error: 'Failed to apply promo code.' });
    }
  }
);

router.get('/dashboard', authenticateToken, requireAffiliate, async (req, res) => {
  try {
    const referrals = await Referral.find({ affiliate: req.affiliate._id })
      .populate('referredUser', 'username email balance createdAt')
      .sort({ createdAt: -1 });

    const totals = referrals.reduce((acc, referral) => {
      acc.referredUsers += 1;
      acc.totalDeposits += referral.depositTotal || 0;
      acc.totalLosses += referral.lossTotal || 0;
      acc.totalCommission += referral.commissionEarned || 0;
      return acc;
    }, {
      referredUsers: 0,
      totalDeposits: 0,
      totalLosses: 0,
      totalCommission: 0
    });

    res.json({
      affiliate: req.affiliate.getPublicProfile(),
      stats: req.affiliate.affiliateStats,
      totals,
      referrals
    });
  } catch (error) {
    console.error('Affiliate dashboard error:', error);
    res.status(500).json({ error: 'Failed to load affiliate dashboard.' });
  }
});

router.get('/referrals', authenticateToken, requireAffiliate, async (req, res) => {
  try {
    const referrals = await Referral.find({ affiliate: req.affiliate._id })
      .populate('referredUser', 'username email balance createdAt')
      .sort({ createdAt: -1 });

    res.json(referrals);
  } catch (error) {
    console.error('Affiliate referrals fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch referrals.' });
  }
});

router.get(
  '/admin/overview',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await connectToMongoDB();

      const affiliates = await User.find({ isAffiliate: true })
        .select('username email promoCode affiliateStats createdAt');

      const referralStats = await Referral.aggregate([
        {
          $group: {
            _id: '$affiliate',
            referredUsers: { $sum: 1 },
            totalDeposits: { $sum: '$depositTotal' },
            totalLosses: { $sum: '$lossTotal' },
            totalCommission: { $sum: '$commissionEarned' }
          }
        }
      ]);

      const statsMap = new Map();
      referralStats.forEach(stat => {
        statsMap.set(stat._id.toString(), stat);
      });

      let summary = {
        affiliates: affiliates.length,
        referredUsers: 0,
        totalDeposits: 0,
        totalLosses: 0,
        totalCommission: 0,
        totalPendingPayout: 0
      };

      const overview = affiliates.map(affiliate => {
        ensureAffiliateStats(affiliate);
        const stat = statsMap.get(affiliate._id.toString()) || {};

        summary.referredUsers += stat.referredUsers || 0;
        summary.totalDeposits += stat.totalDeposits || 0;
        summary.totalLosses += stat.totalLosses || 0;
        summary.totalCommission += stat.totalCommission || 0;
        summary.totalPendingPayout += affiliate.affiliateStats.pendingPayout || 0;

        return {
          id: affiliate._id,
          username: affiliate.username,
          email: affiliate.email,
          promoCode: affiliate.promoCode,
          createdAt: affiliate.createdAt,
          affiliateStats: affiliate.affiliateStats,
          referralStats: {
            referredUsers: stat.referredUsers || 0,
            totalDeposits: stat.totalDeposits || 0,
            totalLosses: stat.totalLosses || 0,
            totalCommission: stat.totalCommission || 0
          }
        };
      });

      res.json({ overview, summary });
    } catch (error) {
      console.error('Affiliate overview error:', error);
      res.status(500).json({ error: 'Failed to load affiliate overview.' });
    }
  }
);

router.get(
  '/admin/:affiliateId',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await connectToMongoDB();

      const { affiliateId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(affiliateId)) {
        return res.status(400).json({ error: 'Invalid affiliate ID.' });
      }

      const affiliate = await User.findById(affiliateId).select('-password');
      if (!affiliate || !affiliate.isAffiliate) {
        return res.status(404).json({ error: 'Affiliate not found.' });
      }

      ensureAffiliateStats(affiliate);

      const referrals = await Referral.find({ affiliate: affiliate._id })
        .populate('referredUser', 'username email balance createdAt')
        .sort({ createdAt: -1 });

      const totals = referrals.reduce((acc, referral) => {
        acc.referredUsers += 1;
        acc.totalDeposits += referral.depositTotal || 0;
        acc.totalLosses += referral.lossTotal || 0;
        acc.totalCommission += referral.commissionEarned || 0;
        return acc;
      }, {
        referredUsers: 0,
        totalDeposits: 0,
        totalLosses: 0,
        totalCommission: 0
      });

      res.json({
        affiliate: affiliate.getPublicProfile(),
        affiliateStats: affiliate.affiliateStats,
        totals,
        referrals
      });
    } catch (error) {
      console.error('Affiliate detail error:', error);
      res.status(500).json({ error: 'Failed to load affiliate details.' });
    }
  }
);

module.exports = router;
