import { SpeechifyClient } from '@speechify/api';

export interface TTSOptions {
  text: string;
  voice?: string;
  language?: string;
  format?: 'mp3' | 'wav' | 'ogg' | 'aac';
  // Legacy ElevenLabs options (not supported by Speechify)
  stability?: number;
  similarity_boost?: number;
}

export interface TTSResponse {
  audioData: string; // base64 encoded audio
  format: string;
  speechMarks?: any;
  billableCharactersCount?: number;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'other';
}

export class SpeechifyTTSProvider {
  private client: SpeechifyClient;

  constructor(apiKey: string) {
    this.client = new SpeechifyClient({ token: apiKey });
  }

  async synthesizeSpeech(options: TTSOptions): Promise<TTSResponse> {
    try {
      // Ignore unsupported ElevenLabs parameters
      const { stability, similarity_boost, ...supportedOptions } = options;
      
      const response = await this.client.tts.audio.speech({
        audioFormat: supportedOptions.format || 'mp3',
        input: supportedOptions.text,
        language: supportedOptions.language,
        model: this.determineModel(supportedOptions.language),
        voiceId: supportedOptions.voice || 'scott',
        options: {
          loudnessNormalization: true,
          textNormalization: true
        }
      });

      return {
        audioData: response.audioData,
        format: response.audioFormat,
        speechMarks: response.speechMarks,
        billableCharactersCount: response.billableCharactersCount
      };
    } catch (error) {
      throw new Error(`Speechify TTS error: ${error}`);
    }
  }

  private determineModel(language?: string): 'simba-english' | 'simba-multilingual' {
    if (language && (language.startsWith('en') || language === 'en')) {
      return 'simba-english';
    }
    return 'simba-multilingual';
  }

  async getVoices(): Promise<Voice[]> {
    try {
      const voices = await this.client.tts.voices.list();
      return voices.map(voice => ({
        id: voice.id,
        name: voice.displayName,
        language: voice.locale || voice.models?.[0]?.languages?.[0]?.locale || 'unknown',
        gender: this.mapGender(voice.gender)
      }));
    } catch (error) {
      throw new Error(`Speechify voices error: ${error}`);
    }
  }

  private mapGender(gender: any): 'male' | 'female' | 'other' {
    switch (gender) {
      case 'male': return 'male';
      case 'female': return 'female';
      default: return 'other';
    }
  }
}

// Backward compatibility wrapper for existing ElevenLabs interface
export class LegacyCompatibleTTSProvider {
  private speechifyProvider: SpeechifyTTSProvider;

  constructor(apiKey: string) {
    this.speechifyProvider = new SpeechifyTTSProvider(apiKey);
  }

  async synthesizeSpeech(options: TTSOptions): Promise<TTSResponse> {
    return this.speechifyProvider.synthesizeSpeech(options);
  }

  async getVoices(): Promise<Voice[]> {
    return this.speechifyProvider.getVoices();
  }
} 