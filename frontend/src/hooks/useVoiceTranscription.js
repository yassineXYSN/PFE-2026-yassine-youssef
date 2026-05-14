/**
 * useVoiceTranscription
 * 
 * Native Web Speech API version (browser-integrated).
 * Simplified and robust to avoid interference.
 */

import { useEffect, useRef } from 'react';
import { apiFetch } from '../core/api';

const senderPrefix = (sender) => (sender === 'Recruteur' ? 'R' : 'C');
const newMsgId = (sender) => `${senderPrefix(sender)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function useVoiceTranscription({
  sender,
  interviewId,
  enabled,
  muted,
  language = 'fr',
  onTranscript,
  onInterim,
  onListeningChange,
}) {
  const recognitionRef = useRef(null);
  const manualStopRef = useRef(false);
  const propsRef = useRef({ sender, interviewId, enabled, muted, language, onTranscript, onInterim, onListeningChange });

  // Update refs to avoid stale closures
  useEffect(() => {
    propsRef.current = { sender, interviewId, enabled, muted, language, onTranscript, onInterim, onListeningChange };
  }, [sender, interviewId, enabled, muted, language, onTranscript, onInterim, onListeningChange]);

  useEffect(() => {
    if (!enabled || !interviewId) {
      if (recognitionRef.current) {
        manualStopRef.current = true;
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Speech] Browser not supported');
      return;
    }

    // If already running, don't recreate
    if (recognitionRef.current) return;

    console.log('[Speech] Initializing...');
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language === 'fr' ? 'fr-FR' : 'en-US';

    rec.onstart = () => {
      console.log('[Speech] Started');
      manualStopRef.current = false;
      propsRef.current.onListeningChange?.(true);
    };

    rec.onresult = (event) => {
      if (propsRef.current.muted) return;

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            const msg_id = newMsgId(propsRef.current.sender);
            propsRef.current.onTranscript?.({ sender: propsRef.current.sender, text, msg_id });
            
            // Save to DB
            apiFetch(`/interviews/${propsRef.current.interviewId}/transcript-entry`, {
              method: 'POST',
              body: JSON.stringify({ sender: propsRef.current.sender, text, msg_id }),
            }).catch(err => console.error('[Speech] Save error:', err));
          }
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) propsRef.current.onInterim?.(interim);
    };

    rec.onerror = (event) => {
      console.error('[Speech] Error event:', event.error);
      if (event.error === 'aborted') return; // Normal
      if (event.error === 'no-speech') return; // Normal
    };

    rec.onend = () => {
      console.log('[Speech] Ended');
      propsRef.current.onListeningChange?.(false);
      recognitionRef.current = null;

      // Only restart if not manually stopped and still enabled
      if (!manualStopRef.current && propsRef.current.enabled) {
        console.log('[Speech] Auto-restarting...');
        setTimeout(() => {
          if (!manualStopRef.current && propsRef.current.enabled) {
            // Re-run the effect essentially by setting recognitionRef to null 
            // but the effect only runs on 'enabled' change.
            // So we manually call start if needed, or just let the next effect cycle handle it?
            // Actually, the effect won't re-run. We need to manually start.
            initRecognition(); 
          }
        }, 1000);
      }
    };

    const initRecognition = () => {
      if (recognitionRef.current) return;
      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (e) {
        console.error('[Speech] Start exception:', e);
        recognitionRef.current = null;
      }
    };

    initRecognition();

    return () => {
      manualStopRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
      }
    };
  }, [enabled, interviewId]);

  // Sync language
  useEffect(() => {
    if (recognitionRef.current) {
      const targetLang = language === 'fr' ? 'fr-FR' : 'en-US';
      if (recognitionRef.current.lang !== targetLang) {
        recognitionRef.current.lang = targetLang;
        // Restart to apply
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    }
  }, [language]);

}
