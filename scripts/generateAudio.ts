/**
 * generateAudio.ts
 *
 * Script to generate TTS audio for a Key To Sleep episode story using Speechify API.
 * Reads story text from an input file, sends to Speechify, saves resulting audio as .mp3.
 * Requires SPEECHIFY_API_KEY in .env.local.
 */

(async () => {
  const fs = require('fs/promises');
  const path = require('path');
  const dotenv = require('dotenv');

  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

  const SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;
  const OUTPUT_DIR = path.resolve(__dirname, '../output');

// Find the most recent story file in the output directory
async function getLatestStoryFile(): Promise<{ path: string, episodeId: string }> {
  const files = await fs.readdir(OUTPUT_DIR);
  const storyFiles = files.filter((f: string) => f.endsWith('-story.txt'));
  if (storyFiles.length === 0) {
    throw new Error('No story files found in output directory.');
  }
  // Sort by episode timestamp descending (most recent first)
  storyFiles.sort((a: string, b: string) => b.localeCompare(a));
  const latest = storyFiles[0];
  const episodeId = latest.replace('-story.txt', '');
  return { path: path.join(OUTPUT_DIR, latest), episodeId };
}

if (!SPEECHIFY_API_KEY) {
  console.error('Missing SPEECHIFY_API_KEY in environment.');
  process.exit(1);
}

async function generateAudio() {
  try {
    const { path: storyFilePath, episodeId } = await getLatestStoryFile();
    const storyText = await fs.readFile(storyFilePath, 'utf8');
    const outputAudioFile = path.join(OUTPUT_DIR, `${episodeId}-audio.mp3`);

    const { SpeechifyTTSProvider } = await import('../lib/speechify-tts');
    const ttsProvider = new SpeechifyTTSProvider(SPEECHIFY_API_KEY!);

    const ttsResponse = await ttsProvider.synthesizeSpeech({
      text: storyText,
      format: 'mp3',
      voice: process.env.SPEECHIFY_VOICE_ID || 'scott',
      language: 'en',
      stability: 0.5,
      similarity_boost: 0.8
    });

    const audioBuffer = Buffer.from(ttsResponse.audioData, 'base64');
    await fs.writeFile(outputAudioFile, audioBuffer);
    console.log(`Audio saved to ${outputAudioFile}`);
  } catch (err) {
    console.error('Error generating audio:', err);
    process.exit(1);
  }
}

generateAudio();
})();
