/**
 * Script to generate promo codes for existing affiliates who don't have one
 * Run with: node scripts/generateAffiliatePromoCodes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Generate a random promo code
function generatePromoCode(username) {
  // Use first 3 letters of username + 4 random chars
  const prefix = username.substring(0, 3).toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${randomChars}`;
}

async function generatePromoCodes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected to MongoDB');

    // Find all affiliates without promo codes
    const affiliatesWithoutCodes = await User.find({
      isAffiliate: true,
      $or: [
        { promoCode: null },
        { promoCode: '' },
        { promoCode: { $exists: false } }
      ]
    });

    console.log(`\nFound ${affiliatesWithoutCodes.length} affiliates without promo codes\n`);

    if (affiliatesWithoutCodes.length === 0) {
      console.log('All affiliates already have promo codes!');
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const affiliate of affiliatesWithoutCodes) {
      let attempts = 0;
      let codeGenerated = false;

      while (!codeGenerated && attempts < 10) {
        try {
          const promoCode = generatePromoCode(affiliate.username);
          
          // Check if code already exists
          const existing = await User.findOne({ promoCode });
          if (existing) {
            attempts++;
            continue;
          }

          // Assign promo code
          affiliate.promoCode = promoCode;
          await affiliate.save();

          console.log(`✓ Generated promo code for ${affiliate.username}: ${promoCode}`);
          successCount++;
          codeGenerated = true;
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key error, try again
            attempts++;
          } else {
            console.error(`✗ Error for ${affiliate.username}:`, error.message);
            errorCount++;
            break;
          }
        }
      }

      if (!codeGenerated && attempts >= 10) {
        console.error(`✗ Failed to generate unique code for ${affiliate.username} after 10 attempts`);
        errorCount++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total: ${affiliatesWithoutCodes.length}`);

    // Display all affiliates with their promo codes
    console.log(`\n=== All Affiliates ===`);
    const allAffiliates = await User.find({ isAffiliate: true })
      .select('username email promoCode affiliateStats')
      .sort({ createdAt: -1 });

    allAffiliates.forEach(affiliate => {
      console.log(`\nUsername: ${affiliate.username}`);
      console.log(`Email: ${affiliate.email || 'N/A'}`);
      console.log(`Promo Code: ${affiliate.promoCode || 'MISSING'}`);
      console.log(`Referred Users: ${affiliate.affiliateStats?.referredUsers || 0}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
generatePromoCodes();
