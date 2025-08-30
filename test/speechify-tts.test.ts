import { SpeechifyTTSProvider, LegacyCompatibleTTSProvider } from '../lib/speechify-tts';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;

// Only run tests if API key is available
(SPEECHIFY_API_KEY ? describe : describe.skip)('Speechify TTS Integration', () => {
  let ttsProvider: SpeechifyTTSProvider;
  let legacyProvider: LegacyCompatibleTTSProvider;

  beforeEach(() => {
    ttsProvider = new SpeechifyTTSProvider(SPEECHIFY_API_KEY!);
    legacyProvider = new LegacyCompatibleTTSProvider(SPEECHIFY_API_KEY!);
  });

  describe('Basic TTS Functionality', () => {
    it('should generate mp3 audio from text', async () => {
      const result = await ttsProvider.synthesizeSpeech({
        text: 'This is a test of Speechify TTS integration.',
        format: 'mp3',
        voice: 'scott',
        language: 'en'
      });

      expect(result.audioData).toBeDefined();
      expect(result.format).toBe('mp3');
      expect(result.billableCharactersCount).toBeGreaterThan(0);
      
      // Verify the audio data is valid base64
      const audioBuffer = Buffer.from(result.audioData, 'base64');
      expect(audioBuffer.byteLength).toBeGreaterThan(1000);
    }, 30000);

    it('should handle different audio formats', async () => {
      const formats: Array<'mp3' | 'wav' | 'ogg' | 'aac'> = ['mp3', 'wav', 'ogg', 'aac'];
      
      for (const format of formats) {
        const result = await ttsProvider.synthesizeSpeech({
          text: 'Testing different audio formats.',
          format,
          voice: 'scott'
        });

        expect(result.format).toBe(format);
        expect(result.audioData).toBeDefined();
      }
    }, 60000);

    it('should work with different languages', async () => {
      const testCases = [
        { text: 'Hello world', language: 'en' },
        { text: 'Bonjour le monde', language: 'fr-FR' },
        { text: 'Hola mundo', language: 'es-ES' }
      ];

      for (const testCase of testCases) {
        const result = await ttsProvider.synthesizeSpeech({
          text: testCase.text,
          format: 'mp3',
          voice: 'scott',
          language: testCase.language
        });

        expect(result.audioData).toBeDefined();
        expect(result.format).toBe('mp3');
      }
    }, 90000);
  });

  describe('Voice Management', () => {
    it('should list available voices', async () => {
      const voices = await ttsProvider.getVoices();
      
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
      
      // Check voice structure
      const voice = voices[0];
      expect(voice.id).toBeDefined();
      expect(voice.name).toBeDefined();
      expect(voice.language).toBeDefined();
      expect(['male', 'female', 'other']).toContain(voice.gender);
    }, 30000);

    it('should filter English voices', async () => {
      const voices = await ttsProvider.getVoices();
      const englishVoices = voices.filter(v => v.language.startsWith('en'));
      
      expect(englishVoices.length).toBeGreaterThan(0);
      englishVoices.forEach(voice => {
        expect(voice.language).toMatch(/^en/);
      });
    }, 30000);
  });

  describe('Backward Compatibility', () => {
    it('should handle legacy ElevenLabs parameters gracefully', async () => {
      const result = await legacyProvider.synthesizeSpeech({
        text: 'Testing backward compatibility with legacy parameters.',
        format: 'mp3',
        voice: 'scott',
        language: 'en',
        stability: 0.5,        // Legacy ElevenLabs parameter
        similarity_boost: 0.8  // Legacy ElevenLabs parameter
      });

      expect(result.audioData).toBeDefined();
      expect(result.format).toBe('mp3');
    }, 30000);

    it('should maintain same interface as legacy provider', async () => {
      const legacyResult = await legacyProvider.synthesizeSpeech({
        text: 'Testing legacy interface.',
        format: 'mp3',
        voice: 'scott'
      });

      const directResult = await ttsProvider.synthesizeSpeech({
        text: 'Testing legacy interface.',
        format: 'mp3',
        voice: 'scott'
      });

      expect(legacyResult.audioData).toBeDefined();
      expect(directResult.audioData).toBeDefined();
      expect(legacyResult.format).toBe(directResult.format);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid API key', async () => {
      const invalidProvider = new SpeechifyTTSProvider('invalid-key');
      
      await expect(
        invalidProvider.synthesizeSpeech({
          text: 'This should fail.',
          format: 'mp3'
        })
      ).rejects.toThrow();
    }, 30000);

    it('should handle empty text', async () => {
      await expect(
        ttsProvider.synthesizeSpeech({
          text: '',
          format: 'mp3'
        })
      ).rejects.toThrow();
    }, 30000);

    it('should handle medium text', async () => {
      const mediumText = 'This is a medium length text for testing. '.repeat(50);
      
      const result = await ttsProvider.synthesizeSpeech({
        text: mediumText,
        format: 'mp3',
        voice: 'scott'
      });

      expect(result.audioData).toBeDefined();
      expect(result.billableCharactersCount).toBeGreaterThan(50);
    }, 60000);
  });

  describe('Model Selection', () => {
    it('should use simba-english for English text', async () => {
      const result = await ttsProvider.synthesizeSpeech({
        text: 'English text should use simba-english model.',
        format: 'mp3',
        voice: 'scott',
        language: 'en'
      });

      expect(result.audioData).toBeDefined();
    }, 30000);

    it('should use simba-multilingual for non-English text', async () => {
      const result = await ttsProvider.synthesizeSpeech({
        text: 'Texto en español debería usar el modelo simba-multilingual.',
        format: 'mp3',
        voice: 'scott',
        language: 'es-ES'
      });

      expect(result.audioData).toBeDefined();
    }, 30000);
  });

  describe('Speech Marks and Metadata', () => {
    it('should return speech marks when available', async () => {
      const result = await ttsProvider.synthesizeSpeech({
        text: 'This text should have speech marks.',
        format: 'mp3',
        voice: 'scott'
      });

      expect(result.audioData).toBeDefined();
      // Speech marks might be undefined depending on the API response
      if (result.speechMarks) {
        expect(typeof result.speechMarks).toBe('object');
      }
    }, 30000);

    it('should return billable character count', async () => {
      const testText = 'This is a test text for character counting.';
      const result = await ttsProvider.synthesizeSpeech({
        text: testText,
        format: 'mp3',
        voice: 'scott'
      });

      expect(result.billableCharactersCount).toBeGreaterThan(0);
      expect(result.billableCharactersCount).toBeLessThanOrEqual(testText.length);
    }, 30000);
  });
}); 