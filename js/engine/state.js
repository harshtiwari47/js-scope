/* ==========================================================================
   STATE.JS - Global Application & Execution State Store
   ========================================================================== */

class StateStore {
    constructor() {
        this.code = '';
        this.snapshots = []; // List of step snapshot records
        this.currentStep = 0;
        this.isPlaying = false;
        this.speed = 1.0;
        this.timer = null;
        this.activeTab = 'tab-memory';
        this.listeners = new Map();
    }

    setSnapshots(snapshots) {
        this.snapshots = snapshots;
        this.currentStep = 0;
        this.notify('stepsChanged', {
            totalSteps: this.snapshots.length,
            currentStep: this.currentStep
        });
        if (this.snapshots.length > 0) {
            this.emitStepUpdate();
        }
    }

    setStep(stepIndex) {
        if (stepIndex < 0) stepIndex = 0;
        if (stepIndex >= this.snapshots.length) {
            stepIndex = Math.max(0, this.snapshots.length - 1);
            this.pause();
        }
        this.currentStep = stepIndex;
        this.emitStepUpdate();
    }

    nextStep() {
        if (this.currentStep < this.snapshots.length - 1) {
            this.setStep(this.currentStep + 1);
            return true;
        } else {
            this.pause();
            return false;
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.setStep(this.currentStep - 1);
            return true;
        }
        return false;
    }

    play() {
        if (this.isPlaying) return;
        if (this.currentStep >= this.snapshots.length - 1) {
            this.currentStep = 0; // Restart from start if reached end
        }
        this.isPlaying = true;
        this.notify('playStateChanged', { isPlaying: true });
        this.scheduleNextStep();
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.notify('playStateChanged', { isPlaying: false });
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    scheduleNextStep() {
        if (!this.isPlaying) return;
        const interval = Math.max(100, 1000 / this.speed);
        this.timer = setTimeout(() => {
            const hasMore = this.nextStep();
            if (hasMore && this.isPlaying) {
                this.scheduleNextStep();
            }
        }, interval);
    }

    setSpeed(speedVal) {
        this.speed = parseFloat(speedVal) || 1.0;
        this.notify('speedChanged', { speed: this.speed });
    }

    reset() {
        this.pause();
        this.currentStep = 0;
        if (this.snapshots.length > 0) {
            this.emitStepUpdate();
        }
    }

    getCurrentSnapshot() {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.currentStep];
    }

    emitStepUpdate() {
        const snapshot = this.getCurrentSnapshot();
        this.notify('stepUpdate', {
            step: this.currentStep,
            totalSteps: this.snapshots.length,
            snapshot: snapshot
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    notify(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }
}

export const appState = new StateStore();
