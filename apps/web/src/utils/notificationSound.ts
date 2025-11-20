/**
 * Notification sound utility for playing audio notifications
 */

export interface NotificationSoundOptions {
    volume?: number;
    type?: 'default' | 'urgent' | 'mention' | 'success' | 'error';
}

export class NotificationSoundManager {
    private static instance: NotificationSoundManager;
    private audioContext: AudioContext | null = null;
    private soundCache: Map<string, AudioBuffer> = new Map();
    private lastPlayTime: number = 0;
    private throttleDelay: number = 1000; // 1 second throttle

    private constructor() {
        this.initializeAudioContext();
    }

    public static getInstance(): NotificationSoundManager {
        if (!NotificationSoundManager.instance) {
            NotificationSoundManager.instance = new NotificationSoundManager();
        }
        return NotificationSoundManager.instance;
    }

    private initializeAudioContext(): void {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    /**
     * Generate a simple notification sound using Web Audio API
     */
    private generateNotificationSound(type: string = 'default'): AudioBuffer | null {
        if (!this.audioContext) return null;

        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.3; // 300ms
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // Generate different tones based on notification type
        let frequency1: number, frequency2: number;

        switch (type) {
            case 'urgent':
                frequency1 = 880; // A5
                frequency2 = 1108; // C#6
                break;
            case 'mention':
                frequency1 = 659; // E5
                frequency2 = 784; // G5
                break;
            case 'success':
                frequency1 = 523; // C5
                frequency2 = 659; // E5
                break;
            case 'error':
                frequency1 = 415; // G#4
                frequency2 = 311; // D#4
                break;
            default:
                frequency1 = 523; // C5
                frequency2 = 659; // E5
        }

        // Generate a pleasant two-tone notification sound
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const envelope = Math.exp(-time * 3); // Exponential decay

            if (time < duration / 2) {
                // First tone
                data[i] = Math.sin(2 * Math.PI * frequency1 * time) * envelope * 0.3;
            } else {
                // Second tone
                data[i] = Math.sin(2 * Math.PI * frequency2 * time) * envelope * 0.3;
            }
        }

        return buffer;
    }

    /**
     * Play notification sound with throttling
     */
    public async playNotificationSound(options: NotificationSoundOptions = {}): Promise<void> {
        const { volume = 0.3, type = 'default' } = options;

        // Throttle sound playback
        const now = Date.now();
        if (now - this.lastPlayTime < this.throttleDelay) {
            return;
        }
        this.lastPlayTime = now;

        try {
            // Try Web Audio API first
            if (this.audioContext) {
                await this.playWebAudioSound(type, volume);
            } else {
                // Fallback to HTML5 Audio
                await this.playHtmlAudioSound(type, volume);
            }
        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }

    private async playWebAudioSound(type: string, volume: number): Promise<void> {
        if (!this.audioContext) return;

        // Resume audio context if suspended (required by some browsers)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        let buffer = this.soundCache.get(type);
        if (!buffer) {
            buffer = this.generateNotificationSound(type);
            if (buffer) {
                this.soundCache.set(type, buffer);
            }
        }

        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;
        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.start();
    }

    private async playHtmlAudioSound(type: string, volume: number): Promise<void> {
        // Create a simple beep sound using data URL
        const frequency = type === 'urgent' ? 880 : 523;
        const duration = 300;

        // Generate a simple sine wave data URL
        const sampleRate = 8000;
        const samples = duration * sampleRate / 1000;
        const data = new Array(samples);

        for (let i = 0; i < samples; i++) {
            const time = i / sampleRate;
            const envelope = Math.exp(-time * 3);
            data[i] = Math.sin(2 * Math.PI * frequency * time) * envelope * 127;
        }

        // Convert to WAV format (simplified)
        const wavData = this.createWavData(data, sampleRate);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.volume = Math.max(0, Math.min(1, volume));

        try {
            await audio.play();
        } finally {
            // Clean up object URL after playing
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    private createWavData(samples: number[], sampleRate: number): ArrayBuffer {
        const length = samples.length;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);

        // Convert samples to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-32768, Math.min(32767, samples[i] * 256));
            view.setInt16(offset, sample, true);
            offset += 2;
        }

        return buffer;
    }

    /**
     * Test if audio playback is supported
     */
    public isAudioSupported(): boolean {
        return !!(this.audioContext || window.Audio);
    }

    /**
     * Set throttle delay for sound playback
     */
    public setThrottleDelay(delay: number): void {
        this.throttleDelay = Math.max(0, delay);
    }

    /**
     * Preload sounds for better performance
     */
    public preloadSounds(): void {
        if (!this.audioContext) return;

        const types = ['default', 'urgent', 'mention', 'success', 'error'];
        types.forEach(type => {
            const buffer = this.generateNotificationSound(type);
            if (buffer) {
                this.soundCache.set(type, buffer);
            }
        });
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.soundCache.clear();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}

// Export singleton instance
export const notificationSound = NotificationSoundManager.getInstance();

// Convenience functions
export const playNotificationSound = (options?: NotificationSoundOptions) =>
    notificationSound.playNotificationSound(options);

export const playUrgentSound = () =>
    notificationSound.playNotificationSound({ type: 'urgent', volume: 0.5 });

export const playMentionSound = () =>
    notificationSound.playNotificationSound({ type: 'mention', volume: 0.4 });

export const playSuccessSound = () =>
    notificationSound.playNotificationSound({ type: 'success', volume: 0.3 });

export const playErrorSound = () =>
    notificationSound.playNotificationSound({ type: 'error', volume: 0.4 });