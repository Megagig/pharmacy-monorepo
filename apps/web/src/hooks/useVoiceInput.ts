import { useState, useCallback, useRef, useEffect } from 'react';

interface VoiceInputOptions {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    maxAlternatives?: number;
    onResult?: (transcript: string, confidence: number) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
}

interface VoiceInputState {
    isListening: boolean;
    isSupported: boolean;
    transcript: string;
    confidence: number;
    error: string | null;
}

interface VoiceInputControls {
    start: () => void;
    stop: () => void;
    toggle: () => void;
    reset: () => void;
}

type UseVoiceInputReturn = [VoiceInputState, VoiceInputControls];

/**
 * Custom hook for voice input functionality
 * Provides speech recognition capabilities for mobile and desktop browsers
 */
export const useVoiceInput = (options: VoiceInputOptions = {}): UseVoiceInputReturn => {
    const {
        language = 'en-US',
        continuous = false,
        interimResults = false,
        maxAlternatives = 1,
        onResult,
        onError,
        onStart,
        onEnd,
    } = options;

    const [state, setState] = useState<VoiceInputState>({
        isListening: false,
        isSupported: false,
        transcript: '',
        confidence: 0,
        error: null,
    });

    const recognitionRef = useRef<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check for speech recognition support
    useEffect(() => {
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition ||
            (window as any).mozSpeechRecognition ||
            (window as any).msSpeechRecognition;

        if (SpeechRecognition) {
            setState(prev => ({ ...prev, isSupported: true }));

            // Initialize recognition instance
            const recognition = new SpeechRecognition();
            recognition.lang = language;
            recognition.continuous = continuous;
            recognition.interimResults = interimResults;
            recognition.maxAlternatives = maxAlternatives;

            // Event handlers
            recognition.onstart = () => {
                setState(prev => ({ ...prev, isListening: true, error: null }));
                onStart?.();
            };

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';
                let bestConfidence = 0;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;
                    const confidence = result[0].confidence || 0;

                    if (result.isFinal) {
                        finalTranscript += transcript;
                        bestConfidence = Math.max(bestConfidence, confidence);
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const currentTranscript = finalTranscript || interimTranscript;

                setState(prev => ({
                    ...prev,
                    transcript: currentTranscript,
                    confidence: bestConfidence,
                }));

                if (finalTranscript) {
                    onResult?.(finalTranscript, bestConfidence);
                }
            };

            recognition.onerror = (event: any) => {
                const errorMessage = getErrorMessage(event.error);
                setState(prev => ({
                    ...prev,
                    isListening: false,
                    error: errorMessage,
                }));
                onError?.(errorMessage);
            };

            recognition.onend = () => {
                setState(prev => ({ ...prev, isListening: false }));
                onEnd?.();
            };

            recognitionRef.current = recognition;
        } else {
            setState(prev => ({
                ...prev,
                isSupported: false,
                error: 'Speech recognition not supported in this browser'
            }));
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [language, continuous, interimResults, maxAlternatives, onResult, onError, onStart, onEnd]);

    const start = useCallback(() => {
        if (!state.isSupported || !recognitionRef.current) {
            const error = 'Speech recognition not supported';
            setState(prev => ({ ...prev, error }));
            onError?.(error);
            return;
        }

        if (state.isListening) {
            return;
        }

        try {
            // Reset previous state
            setState(prev => ({
                ...prev,
                transcript: '',
                confidence: 0,
                error: null,
            }));

            recognitionRef.current.start();

            // Auto-stop after 30 seconds to prevent battery drain
            timeoutRef.current = setTimeout(() => {
                stop();
            }, 30000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start voice recognition';
            setState(prev => ({ ...prev, error: errorMessage }));
            onError?.(errorMessage);
        }
    }, [state.isSupported, state.isListening, onError]);

    const stop = useCallback(() => {
        if (recognitionRef.current && state.isListening) {
            recognitionRef.current.stop();
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, [state.isListening]);

    const toggle = useCallback(() => {
        if (state.isListening) {
            stop();
        } else {
            start();
        }
    }, [state.isListening, start, stop]);

    const reset = useCallback(() => {
        stop();
        setState(prev => ({
            ...prev,
            transcript: '',
            confidence: 0,
            error: null,
        }));
    }, [stop]);

    return [
        state,
        {
            start,
            stop,
            toggle,
            reset,
        },
    ];
};

/**
 * Get user-friendly error message from speech recognition error
 */
function getErrorMessage(error: string): string {
    switch (error) {
        case 'no-speech':
            return 'No speech detected. Please try again.';
        case 'audio-capture':
            return 'Microphone not available. Please check permissions.';
        case 'not-allowed':
            return 'Microphone access denied. Please allow microphone access.';
        case 'network':
            return 'Network error. Please check your connection.';
        case 'service-not-allowed':
            return 'Speech recognition service not available.';
        case 'bad-grammar':
            return 'Speech recognition grammar error.';
        case 'language-not-supported':
            return 'Language not supported for speech recognition.';
        default:
            return `Speech recognition error: ${error}`;
    }
}

/**
 * Hook for simple voice-to-text input
 * Returns a simplified interface for basic voice input needs
 */
export const useSimpleVoiceInput = () => {
    const [{ isListening, isSupported, transcript, error }, { start, stop, reset }] = useVoiceInput({
        continuous: false,
        interimResults: false,
    });

    return {
        isListening,
        isSupported,
        transcript,
        error,
        startListening: start,
        stopListening: stop,
        resetTranscript: reset,
    };
};

/**
 * Hook for continuous voice input with real-time results
 */
export const useContinuousVoiceInput = (onTranscript?: (text: string) => void) => {
    const [state, controls] = useVoiceInput({
        continuous: true,
        interimResults: true,
        onResult: onTranscript,
    });

    return [state, controls] as const;
};

/**
 * Hook for voice commands recognition
 */
export const useVoiceCommands = (commands: Record<string, () => void>) => {
    const commandKeys = Object.keys(commands);

    const [{ isListening, isSupported, error }, { start, stop, toggle }] = useVoiceInput({
        continuous: true,
        interimResults: false,
        onResult: (transcript) => {
            const normalizedTranscript = transcript.toLowerCase().trim();

            // Find matching command
            const matchedCommand = commandKeys.find(command =>
                normalizedTranscript.includes(command.toLowerCase())
            );

            if (matchedCommand) {
                commands[matchedCommand]();
                stop(); // Stop listening after command execution
            }
        },
    });

    return {
        isListening,
        isSupported,
        error,
        startListening: start,
        stopListening: stop,
        toggleListening: toggle,
        availableCommands: commandKeys,
    };
};

export default useVoiceInput;