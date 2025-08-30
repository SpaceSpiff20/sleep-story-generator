/**
 * test-speechify.ts
 *
 * Simple test script to verify Speechify TTS integration.
 * Requires SPEECHIFY_API_KEY in .env.local.
 */

(async () => {
  const fs = require('fs/promises');
  const path = require('path');
  const dotenv = require('dotenv');

  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

  const SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;

  if (!SPEECHIFY_API_KEY) {
    console.error('Missing SPEECHIFY_API_KEY in environment.');
    process.exit(1);
  }

  async function testSpeechify() {
    try {
      console.log('Testing Speechify TTS integration...');
      
      const { SpeechifyTTSProvider } = require('../lib/speechify-tts');
      const ttsProvider = new SpeechifyTTSProvider(SPEECHIFY_API_KEY!);

      // Test 1: Basic TTS
      console.log('1. Testing basic TTS...');
      const result = await ttsProvider.synthesizeSpeech({
        text: 'This is a test of the Speechify TTS integration for the sleep story generator.',
        format: 'mp3',
        voice: 'scott',
        language: 'en'
      });

      console.log('✅ Basic TTS successful');
      console.log(`   Format: ${result.format}`);
      console.log(`   Characters billed: ${result.billableCharactersCount}`);
      console.log(`   Audio data length: ${result.audioData.length} characters`);

      // Test 2: Voice listing
      console.log('\n2. Testing voice listing...');
      const voices = await ttsProvider.getVoices();
      console.log(`✅ Found ${voices.length} voices`);
      
      const englishVoices = voices.filter((v: any) => v.language.startsWith('en'));
      console.log(`   English voices: ${englishVoices.length}`);
      
      if (englishVoices.length > 0) {
        console.log(`   Sample English voice: ${englishVoices[0].name} (${englishVoices[0].id})`);
      }

      // Test 3: Different format
      console.log('\n3. Testing different audio format...');
      const wavResult = await ttsProvider.synthesizeSpeech({
        text: 'Testing WAV format.',
        format: 'wav',
        voice: 'scott'
      });

      console.log('✅ WAV format successful');
      console.log(`   Format: ${wavResult.format}`);

      // Test 4: Legacy compatibility
      console.log('\n4. Testing backward compatibility...');
      const legacyResult = await ttsProvider.synthesizeSpeech({
        text: 'Testing legacy parameters.',
        format: 'mp3',
        voice: 'scott',
        language: 'en',
        stability: 0.5,        // Legacy parameter (ignored)
        similarity_boost: 0.8  // Legacy parameter (ignored)
      });

      console.log('✅ Backward compatibility successful');
      console.log(`   Format: ${legacyResult.format}`);

      // Test 5: Save test audio
      console.log('\n5. Saving test audio...');
      const testDir = path.resolve(__dirname, '../test-output');
      await fs.mkdir(testDir, { recursive: true });
      
      const testFile = path.join(testDir, 'speechify-test.mp3');
      const audioBuffer = Buffer.from(result.audioData, 'base64');
      await fs.writeFile(testFile, audioBuffer);
      
      console.log(`✅ Test audio saved to: ${testFile}`);
      console.log(`   File size: ${audioBuffer.byteLength} bytes`);

      console.log('\n🎉 All Speechify TTS tests passed!');
      console.log('\nMigration Summary:');
      console.log('✅ Basic TTS functionality working');
      console.log('✅ Voice management working');
      console.log('✅ Multiple formats supported');
      console.log('✅ Backward compatibility maintained');
      console.log('✅ Audio output generated successfully');

    } catch (err) {
      console.error('❌ Speechify TTS test failed:', err);
      process.exit(1);
    }
  }

  testSpeechify();
})(); 