# ClassyBet Casino Games - Deployment Checklist

## Pre-Deployment

### 1. File Preparation
- [ ] Extract `classybet-games.zip` to your local machine
- [ ] Review all HTML files for correct paths
- [ ] Verify JavaScript files are present in `/js/` folder
- [ ] Check that `casino-game.js` is included (required base class)

### 2. Asset Preparation
- [ ] Prepare game thumbnail images (recommended 400x300px)
  - baccarat.jpg
  - jetx.jpg
  - blackjack.jpg
  - keno.jpg
  - mines.jpg
  - plinko.jpg
  - roulette.jpg
  - slots.jpg (for Ultimate Hot)
- [ ] Place images in `/images/` directory on server

### 3. Server Requirements Check
- [ ] Web server running (Apache/Nginx)
- [ ] HTTPS enabled (recommended for production)
- [ ] PHP/Node.js backend (if using API integration)
- [ ] Database access (if storing game history)

---

## Deployment Steps

### Phase 1: Upload Files (15 minutes)

#### Upload HTML Files
- [ ] Upload `baccarat.html` to root directory
- [ ] Upload `jetx.html` to root directory
- [ ] Upload `blackjack.html` to root directory
- [ ] Upload `keno.html` to root directory
- [ ] Upload `mines.html` to root directory
- [ ] Upload `plinko.html` to root directory
- [ ] Upload `roulette.html` to root directory
- [ ] Upload `ultimate-hot.html` to root directory

#### Upload JavaScript Files
- [ ] Upload `js/casino-game.js` (MUST be first)
- [ ] Upload `js/baccarat-game.js`
- [ ] Upload `js/jetx-game.js`
- [ ] Upload `js/blackjack-game.js`
- [ ] Upload `js/keno-game.js`
- [ ] Upload `js/mines-game.js`
- [ ] Upload `js/plinko-game.js`
- [ ] Upload `js/roulette-game.js`
- [ ] Upload `js/ultimate-hot-game.js`

#### Set File Permissions
```bash
chmod 644 *.html
chmod 644 js/*.js
```

### Phase 2: Dashboard Integration (10 minutes)

#### Update dashboard.html
- [ ] Open `dashboard.html` in editor
- [ ] Locate the games grid section
- [ ] Add/update game cards with correct links:

```html
<!-- Example game card -->
<div class="game-card" onclick="window.location.href='baccarat.html'">
    <img src="images/baccarat.jpg" alt="Speed Baccarat">
    <h3>Speed Baccarat</h3>
    <p class="game-status">New</p>
</div>
```

- [ ] Save and upload updated `dashboard.html`

### Phase 3: Testing (30 minutes)

#### Desktop Testing
- [ ] Test Baccarat on Chrome
- [ ] Test JetX on Chrome
- [ ] Test Blackjack on Chrome
- [ ] Test Keno on Chrome
- [ ] Test Mines on Chrome
- [ ] Test Plinko on Chrome
- [ ] Test Roulette on Chrome
- [ ] Test Ultimate Hot on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari (if available)

#### Mobile Testing
- [ ] Test all games on mobile Chrome
- [ ] Test all games on mobile Safari
- [ ] Verify touch controls work
- [ ] Check landscape orientation

#### Functionality Testing
For each game:
- [ ] Game loads without errors
- [ ] Balance displays correctly
- [ ] Can place minimum bet (KES 10)
- [ ] Game logic executes properly
- [ ] Win/loss calculated correctly
- [ ] Animations play smoothly
- [ ] "Back to Lobby" button works
- [ ] No console errors

### Phase 4: Backend Integration (Optional - 2 hours)

#### API Endpoint Setup
- [ ] Create `/api/user/balance` endpoint
- [ ] Create `/api/casino/play` endpoint
- [ ] Create `/api/analytics/game-action` endpoint (optional)
- [ ] Test API responses with Postman

#### Database Setup
- [ ] Create `game_bets` table
- [ ] Create `game_results` table
- [ ] Create `user_balance_history` table
- [ ] Set up indexes for performance

#### Security Implementation
- [ ] Implement JWT token validation
- [ ] Add rate limiting (max 10 bets/minute)
- [ ] Validate bet amounts server-side
- [ ] Log all transactions
- [ ] Enable HTTPS

### Phase 5: Production Launch (30 minutes)

#### Final Checks
- [ ] All games accessible from dashboard
- [ ] No broken links
- [ ] Images loading correctly
- [ ] Mobile responsive
- [ ] No JavaScript errors
- [ ] API integration working (if implemented)

#### Performance Optimization
- [ ] Enable gzip compression
- [ ] Set cache headers for static files
- [ ] Minify JavaScript (optional)
- [ ] Optimize images

#### Monitoring Setup
- [ ] Set up error logging
- [ ] Configure analytics tracking
- [ ] Set up uptime monitoring
- [ ] Create backup schedule

#### Go Live
- [ ] Announce new games to users
- [ ] Monitor for issues
- [ ] Collect user feedback

---

## Post-Deployment

### Week 1
- [ ] Monitor game usage statistics
- [ ] Check for any error reports
- [ ] Gather user feedback
- [ ] Fix any critical bugs

### Week 2
- [ ] Analyze popular games
- [ ] Optimize underperforming games
- [ ] Consider adding new features
- [ ] Plan marketing campaigns

### Ongoing
- [ ] Regular security audits
- [ ] Performance monitoring
- [ ] User engagement tracking
- [ ] Feature updates

---

## Rollback Plan

If issues occur:

1. **Immediate Rollback**
   ```bash
   # Remove game files
   rm baccarat.html jetx.html blackjack.html keno.html mines.html plinko.html roulette.html ultimate-hot.html
   rm js/*-game.js
   ```

2. **Restore Dashboard**
   - Revert `dashboard.html` to previous version
   - Clear browser cache
   - Test original Aviator game still works

3. **Investigate Issues**
   - Check server logs
   - Review browser console errors
   - Test in isolated environment

4. **Fix and Redeploy**
   - Apply fixes
   - Test thoroughly
   - Deploy again

---

## Support Contacts

**Technical Issues**: [Your support email]  
**Emergency Contact**: [Your phone number]  
**Documentation**: See `INTEGRATION_GUIDE.md`

---

## Success Criteria

✅ All 8 games accessible  
✅ No critical errors  
✅ Mobile responsive  
✅ Fast loading (<3 seconds)  
✅ Positive user feedback  
✅ API integration working (if implemented)  

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| File Upload | 15 min | ⏳ |
| Dashboard Update | 10 min | ⏳ |
| Testing | 30 min | ⏳ |
| Backend Integration | 2 hours | ⏳ (Optional) |
| Production Launch | 30 min | ⏳ |
| **Total** | **3-4 hours** | |

---

## Notes

- Games work in demo mode without backend
- Backend integration recommended for production
- All games tested and production-ready
- Mobile-first design approach
- No external dependencies except Font Awesome

---

**Ready to deploy?** Follow this checklist step by step! ✅

**Questions?** Refer to `INTEGRATION_GUIDE.md` for detailed instructions.
