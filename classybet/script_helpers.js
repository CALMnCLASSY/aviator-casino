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

        const response = await fetch(`${baseURL}/api/rounds/state?limit=5`, {
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

        this.nextRoundMeta = normalized.length > 0 ? normalized[0] : null;
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
    if (!this.nextRoundMeta) {
        await this.fetchRoundSchedule();
    }

    if (this.nextRoundMeta) {
        this.activeRoundMeta = this.nextRoundMeta;
        this.nextRoundMeta = null;

        if (this.activeRoundMeta && this.activeRoundMeta.multiplier) {
            this.forcedCrashMultiplier = this.activeRoundMeta.multiplier;
            this.randomStop = Math.max(1.01, this.forcedCrashMultiplier);
        }

        if (window.classyBetAPI && typeof classyBetAPI.setGameRound === 'function' && classyBetAPI.isAuthenticated()) {
            classyBetAPI.setGameRound(this.activeRoundMeta.roundId);
        }
    } else {
        this.activeRoundMeta = null;
        this.forcedCrashMultiplier = null;
    }
}

// Attach helpers to AviatorGame prototype
if (typeof AviatorGame !== 'undefined') {
    AviatorGame.prototype.fetchRoundSchedule = fetchRoundSchedule;
    AviatorGame.prototype.normalizeRoundEntry = normalizeRoundEntry;
    AviatorGame.prototype.ensureRoundMeta = ensureRoundMeta;
}
