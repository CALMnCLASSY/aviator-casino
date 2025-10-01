// Migration script to fix existing users
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function fixExistingUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Find users without userId or fullPhone
        const usersToFix = await User.find({
            $or: [
                { userId: { $exists: false } },
                { fullPhone: { $exists: false } }
            ]
        });

        console.log(`Found ${usersToFix.length} users to fix`);

        for (const user of usersToFix) {
            let updated = false;

            // Generate userId if missing
            if (!user.userId) {
                user.userId = await User.generateUserId();
                updated = true;
            }

            // Generate fullPhone if missing
            if (!user.fullPhone && user.phone) {
                // Assume +254 for existing users without country code
                user.countryCode = user.countryCode || '+254';
                user.fullPhone = user.phone.startsWith('+') ? user.phone : `${user.countryCode}${user.phone}`;
                updated = true;
            }

            if (updated) {
                await user.save();
                console.log(`Fixed user: ${user.username} - ID: ${user.userId}`);
            }
        }

        console.log('Migration completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

fixExistingUsers();