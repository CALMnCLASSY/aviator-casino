// Round synchronization helpers for AviatorGame
// These methods fetch backend round schedule and sync multipliers

async function fetchRoundSchedule() {
    if (this.roundSyncInProgress) {
        return;
    }

    this.roundSyncInProgress = true;

    try {
        const baseURL = window.classyBetAPI ? classyBetAPI.baseURL : API_BASE;
        const token = window.classyBetAPI ? classyBetAPI.token : localStorage.getItem('user_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${baseURL}/api/rounds/state?limit=10`, {
            headers
        });

        if (!response.ok) {
            throw new Error(`Round state request failed with status ${response.status}`);
        }

        const data = await response.json();

        const rounds = [];
        if (data.currentRound) {
            rounds.push(data.currentRound);
        }
        if (data.nextRound) {
            rounds.push(data.nextRound);
        }
        if (Array.isArray(data.upcoming)) {
            rounds.push(...data.upcoming);
        }

        const normalized = rounds
            .map((item) => this.normalizeRoundEntry(item))
            .filter(Boolean)
            .sort((a, b) => a.startTime - b.startTime);

        // Store all upcoming rounds, not just the first one
        if (!this.roundQueue) {
            this.roundQueue = [];
        }
        
        // Update the queue with new rounds
        normalized.forEach(round => {
            const exists = this.roundQueue.find(r => r.roundId === round.roundId);
            if (!exists) {
                this.roundQueue.push(round);
            }
        });
        
        // Sort queue by start time
        this.roundQueue.sort((a, b) => a.startTime - b.startTime);
        
        // Set nextRoundMeta to the first available round
        this.nextRoundMeta = this.roundQueue.length > 0 ? this.roundQueue[0] : null;
    } catch (error) {
        console.warn('Failed to fetch round schedule:', error);
    } finally {
        this.roundSyncInProgress = false;
    }
}

function normalizeRoundEntry(round) {
    if (!round || round.roundId == null) {
        return null;
    }

    const roundId = Number(round.roundId);
    const multiplier = Number(round.multiplier);
    const startTime = round.startTime ? new Date(round.startTime).getTime() : null;

    if (Number.isNaN(roundId) || !startTime) {
        return null;
    }

    return {
        roundId,
        multiplier: Number.isNaN(multiplier) ? null : multiplier,
        startTime
    };
}

async function ensureRoundMeta() {
    if (!this.roundQueue) {
        this.roundQueue = [];
    }
    
    // Fetch if queue is empty
    if (this.roundQueue.length === 0) {
        await this.fetchRoundSchedule();
    }

    // Pop the next round from the queue ONLY if we don't already have an active round
    if (!this.activeRoundMeta && this.roundQueue.length > 0) {
        this.activeRoundMeta = this.roundQueue.shift();
        this.nextRoundMeta = this.roundQueue.length > 0 ? this.roundQueue[0] : null;

        if (this.activeRoundMeta && this.activeRoundMeta.multiplier) {
            this.forcedCrashMultiplier = this.activeRoundMeta.multiplier;
            this.randomStop = Math.max(1.01, this.forcedCrashMultiplier);
        }

        // Set game round for betting
        if (window.classyBetAPI && typeof classyBetAPI.setGameRound === 'function' && classyBetAPI.isAuthenticated()) {
            classyBetAPI.setGameRound(this.activeRoundMeta.roundId);
        }
        
        // Fetch more rounds if queue is running low
        if (this.roundQueue.length < 3) {
            this.fetchRoundSchedule().catch(err => console.warn('Background round fetch failed:', err));
        }
    } else if (!this.activeRoundMeta) {
        console.warn('No rounds available in queue');
    }
}

// Attach helpers to AviatorGame prototype
if (typeof AviatorGame !== 'undefined') {
    AviatorGame.prototype.fetchRoundSchedule = fetchRoundSchedule;
    AviatorGame.prototype.normalizeRoundEntry = normalizeRoundEntry;
    AviatorGame.prototype.ensureRoundMeta = ensureRoundMeta;
}
