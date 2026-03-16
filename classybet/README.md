# ClassyBet Aviator Game

Your **ClassyBet** frontend has been successfully converted to match the Fortune Aviator game exactly! This is now a complete, fully functional ClassyBet Aviator gaming platform.

## 🎮 What's New

Your ClassyBet site now includes:
- **Full Fortune Aviator Game Engine** - Complete with all mechanics
- **ClassyBet Branding** - Maintains your brand identity
- **Offline Mode** - Works without external servers
- **Professional UI** - Modern, responsive design
- **Complete Game Features** - Betting, cashouts, avatars, history

## 📁 File Structure

```
ClassyBet/
├── index.html          # ClassyBet landing page
├── dashboard.html      # Main game interface
├── css/               # Stylesheets
├── js/                # JavaScript libraries
├── images/            # Game assets and avatars
├── user/              # Game logic files
├── game/              # Local game data
└── scss/              # Source stylesheets
```

## 🚀 How to Run

### Option 1: VS Code Live Server (Recommended)
1. Install "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"
3. Game opens at `http://localhost:5500`

### Option 2: Python HTTP Server
```bash
cd casino/aviator-betting-game-clone/ClassyBet
python -m http.server 8000
# Open: http://localhost:8000
```

### Option 3: Node.js HTTP Server
```bash
cd casino/aviator-betting-game-clone/ClassyBet
npx http-server -p 8000
# Open: http://localhost:8000
```

## 🌐 Deploy Online

### GitHub Pages
1. Push your `casino` folder to GitHub
2. Enable Pages in repository settings
3. Set source to `main` branch
4. Access: `https://yourusername.github.io/repo-name/casino/aviator-betting-game-clone/ClassyBet`

### Netlify
1. Drag the `ClassyBet` folder to [netlify.com](https://netlify.com)
2. Get instant URL like `https://ClassyBet-aviator.netlify.app`

### Your Own Domain
Upload the `ClassyBet` folder to any web hosting:
- cPanel hosting
- VPS/Dedicated server
- AWS S3 + CloudFront
- Any static hosting service

## ✨ Features

### Game Features
- ✅ Real-time multiplier display
- ✅ Dual betting panels
- ✅ Auto bet and auto cashout
- ✅ Live betting activity
- ✅ Game history tracking
- ✅ Avatar selection (72 avatars)
- ✅ Sound effects and animations

### Technical Features
- ✅ Fully offline capable
- ✅ Mobile responsive
- ✅ Local data simulation
- ✅ No external dependencies in local mode
- ✅ Professional animations
- ✅ Modern UI/UX

## 🎯 Game Flow

1. **Landing Page** (`index.html`) - Professional ClassyBet welcome
2. **Click "Play Now"** - Enters the game
3. **Main Game** (`dashboard.html`) - Full Aviator experience
4. **Place Bets** - Use the betting panels
5. **Watch the Plane** - Multiplier increases
6. **Cash Out** - Click before it flies away!

## 🛠️ Customization

### Branding
- All titles show "ClassyBet"
- Logo: `images/classybetaviator-logo.svg`
- Favicon: ClassyBet branded
- Footer: "© 2025 ClassyBetaviator"

### Game Settings
- Default currency: KES
- Min bet: KES 10
- Max bet: KES 100,000
- Wallet simulation in local mode

### Colors & Styling
- Edit `css/style.css` for custom colors
- SCSS source files in `scss/` folder
- Bootstrap-based responsive design

## 🔧 Local Mode vs Live Mode

### Local Mode (file:// or localhost)
- Simulated betting and payouts
- Fake wallet balance updates
- Local avatar storage
- Sample game history
- No real money involved

### Live Mode (your domain)
- Can integrate with real backend
- Original Fortune Aviator API structure preserved
- Ready for payment processing
- Real user accounts

## 📱 Mobile Friendly

- Responsive design works on all devices
- Touch-friendly betting controls
- Mobile-optimized layouts
- Progressive Web App ready

## 🆘 Troubleshooting

### Game won't load?
- Make sure you're serving from `http://localhost` (not `file://`)
- Check browser console for errors
- Verify all files copied correctly

### Missing images?
- Check `images/` folder exists
- Verify `images/classybetaviator-logo.svg` is present
- Check network tab for 404 errors

### JavaScript errors?
- Ensure `js/` folder is complete
- Check `user/` folder has all `.js` files
- Verify `game/` folder has data files

## 🎉 You're Ready!

Your **ClassyBet Aviator** is now fully functional and ready to deploy! The game maintains all the excitement and features of Fortune Aviator while being completely branded as ClassyBet.

**Next Steps:**
1. Test the game locally
2. Customize colors/styling if desired
3. Deploy to your preferred hosting
4. Share your ClassyBet gaming platform!

---

**Original backup:** Your old ClassyBet files are saved in `ClassyBet-backup/` folder if you need them.

Enjoy your new ClassyBet Aviator gaming platform! 🎮✈️
