import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import { uploadToS3 } from "./s3";
import { progressOperations } from "./supabase";
import { retryGeneration } from "./retry";
import fs from "fs/promises";
import path from "path";
import { embedMP3Metadata, createStoryMetadata } from "./mp3-metadata";

// Types for story customization
export interface StoryCustomization {
  characterName?: string;
  characterAge?: number;
  characterGender?: string;
  hasCompanion?: boolean;
  companionName?: string;
  companionAnimal?: string;
  climate?: string;
  region?: string;
  values?: string[];
}

// Progress callback type
export type ProgressCallback = (
  step: string,
  status: "pending" | "running" | "completed" | "failed",
  error?: string
) => Promise<void>;

// Generation result types
export interface GeneratedStory {
  text: string;
  episodeId: string;
}

export interface GeneratedMetadata {
  title: string;
  description: string;
  episodeId: string;
}

export interface GeneratedArtwork {
  imageUrl: string;
  prompt: string;
  episodeId: string;
}

export interface GeneratedAudio {
  audioUrl: string;
  duration?: number;
  episodeId: string;
}

// Initialize OpenAI
const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not found in environment variables");
  }
  return new OpenAI({ apiKey });
};

// Generate unique episode ID
const generateEpisodeId = (): string => {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "T")
    .replace("Z", "Z");
};

// Read prompt files
const readPrompt = async (promptPath: string): Promise<string> => {
  try {
    const fullPath = path.resolve(process.cwd(), promptPath);
    return (await fs.readFile(fullPath, "utf8")).trim();
  } catch (error) {
    console.error(`Error reading prompt file: ${promptPath}`, error);
    throw new Error(`Failed to read prompt file: ${promptPath}`);
  }
};

// Create custom prompt with story parameters
const createCustomStoryPrompt = async (
  customization: StoryCustomization
): Promise<string> => {
  // Read base prompt and reference scripts
  const basePrompt = await readPrompt("prompts/story.txt");

  // Read reference scripts for inspiration
  const referenceDir = path.resolve(process.cwd(), "prompts/reference_scripts");
  try {
    const referenceFiles = (await fs.readdir(referenceDir)).filter((f) =>
      f.endsWith(".txt")
    );
    let referencesContent = "";

    for (const file of referenceFiles) {
      const refContent = await fs.readFile(
        path.join(referenceDir, file),
        "utf8"
      );
      referencesContent += `--- Reference Script: ${file} ---\n${refContent}\n\n`;
    }

    // Create customization instructions
    let customInstructions = "\n\nCUSTOMIZATION REQUIREMENTS:\n";

    if (customization.characterName) {
      customInstructions += `- Main character name: ${customization.characterName}\n`;
    }

    if (customization.characterAge) {
      customInstructions += `- Character age: ${customization.characterAge} years old\n`;
    }

    if (customization.characterGender) {
      customInstructions += `- Character gender: ${customization.characterGender}\n`;
    }

    if (
      customization.hasCompanion &&
      customization.companionName &&
      customization.companionAnimal
    ) {
      customInstructions += `- Companion: ${customization.companionName} the ${customization.companionAnimal}\n`;
    }

    if (customization.climate && customization.region) {
      customInstructions += `- Setting: ${customization.climate} ${customization.region}\n`;
    }

    if (customization.values && customization.values.length > 0) {
      customInstructions += `- Values to emphasize: ${customization.values.join(
        ", "
      )}\n`;
    }

    customInstructions +=
      "\nPlease incorporate these elements naturally into the story while maintaining the peaceful, sleep-friendly tone.\n";

    return `Here are reference scripts for inspiration (do not copy directly):\n\n${referencesContent}${basePrompt}${customInstructions}`;
  } catch (error) {
    console.warn(
      "Could not read reference scripts, using base prompt only:",
      error
    );
    return basePrompt;
  }
};

/**
 * Generate a custom story based on user parameters
 */
export async function generateCustomStory(
  customization: StoryCustomization,
  jobId: string,
  progressCallback: ProgressCallback
): Promise<GeneratedStory> {
  const episodeId = generateEpisodeId();

  try {
    await progressCallback("story_generation", "running");

    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    // Create custom prompt
    const customPrompt = await createCustomStoryPrompt(customization);

    console.log("Generating custom story with OpenAI...");

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a peaceful sleep story narrator for a podcast. Create calming, imaginative stories that help listeners drift off to sleep.",
        },
        {
          role: "user",
          content: customPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 1800,
    });

    const rawStory = completion.choices[0]?.message.content?.trim() || "";

    if (!rawStory) {
      throw new Error("OpenAI returned empty story content");
    }

    // Clean up the story (remove stage directions, etc.)
    const cleanStory = rawStory
      .split("\n")
      .map((line) => line.replace(/\[[^\]]*\]/g, "").trim())
      .filter((line) => line.length > 0)
      .join("\n");

    await progressCallback("story_generation", "completed");

    return {
      text: cleanStory,
      episodeId,
    };
  } catch (error) {
    console.error("Error generating custom story:", error);
    await progressCallback(
      "story_generation",
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Generate metadata (title and description) from story
 */
export async function generateMetadataFromStory(
  story: GeneratedStory,
  progressCallback: ProgressCallback
): Promise<GeneratedMetadata> {
  try {
    await progressCallback("metadata_generation", "running");

    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    const metadataPrompt = await readPrompt("prompts/metadata.txt");

    console.log("Generating episode metadata...");

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a podcast metadata specialist. Create compelling titles and descriptions for sleep stories.",
        },
        {
          role: "user",
          content: `${metadataPrompt}\n\nSTORY TO ANALYZE:\n${story.text}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const metadataRaw = completion.choices[0]?.message.content?.trim() || "";

    if (!metadataRaw) {
      throw new Error("OpenAI returned empty metadata");
    }

    // Parse the metadata (assuming JSON format from prompt)
    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(metadataRaw);
    } catch {
      // Fallback if not JSON - extract title and description manually
      const lines = metadataRaw.split("\n").filter((line) => line.trim());
      parsedMetadata = {
        title: lines[0] || "Peaceful Sleep Story",
        description:
          lines.slice(1).join(" ") ||
          "A calming bedtime story to help you drift off to sleep.",
      };
    }

    await progressCallback("metadata_generation", "completed");

    return {
      title: parsedMetadata.title || "Peaceful Sleep Story",
      description:
        parsedMetadata.description ||
        "A calming bedtime story to help you drift off to sleep.",
      episodeId: story.episodeId,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    await progressCallback(
      "metadata_generation",
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Generate artwork from story and metadata
 */
export async function generateArtworkFromStory(
  story: GeneratedStory,
  metadata: GeneratedMetadata,
  progressCallback: ProgressCallback
): Promise<GeneratedArtwork> {
  try {
    await progressCallback("artwork_generation", "running");

    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    const artworkPrompt = await readPrompt("prompts/artwork.txt");

    console.log("Generating artwork prompt and image...");

    // First generate the artwork description
    const promptCompletion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            'You are a creative visual artist. Generate detailed image descriptions with TWO CRITICAL requirements: 1) The main character and companion from the story as central focal points in the lower 2/3 of the image. 2) Text "KEY TO SLEEP" must be COMPLETELY VISIBLE with 25% margins from ALL edges - every letter fully contained, no bleeding or cropping. Use Bebas Neue ALL CAPS. Both requirements are EQUALLY important.',
        },
        {
          role: "user",
          content: `${artworkPrompt}\n\nSTORY:\n${
            story.text
          }\n\nMETADATA:\n${JSON.stringify(metadata)}`,
        },
      ],
      temperature: 0.8,
      max_tokens: 900,
    });

    const artworkDescription =
      promptCompletion.choices[0]?.message.content?.trim() || "";

    if (!artworkDescription) {
      throw new Error("Failed to generate artwork description");
    }

    // Generate the actual image
    const imagePromptPrefix =
      'Vintage poster with characters in lower 2/3. CRITICAL: "KEY TO SLEEP" text at top must be COMPLETELY VISIBLE with 25% margins from ALL edges. NO text bleeding off. Text fully contained. Bebas Neue ALL CAPS. ';

    const cleanedPrompt = artworkDescription
      .replace(/\s+/g, " ")
      .replace(/prompts\/reference_artwork\/[^\s]+/g, "")
      .trim();

    const fullPrompt = imagePromptPrefix + cleanedPrompt;
    const promptForImage = fullPrompt.slice(0, 1000);

    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptForImage,
      n: 1,
      size: "1024x1024",
    });

    const imageData = imageResponse.data?.[0];
    if (!imageData?.b64_json) {
      throw new Error("OpenAI returned no image data");
    }

    // Upload to S3
    const imageBuffer = Buffer.from(imageData.b64_json, "base64");
    const s3Key = `sleep-stories/${story.episodeId}/${story.episodeId}-artwork.png`;
    const imageUrl = await uploadToS3(s3Key, imageBuffer, "image/png");

    await progressCallback("artwork_generation", "completed");

    return {
      imageUrl,
      prompt: artworkDescription,
      episodeId: story.episodeId,
    };
  } catch (error) {
    console.error("Error generating artwork:", error);
    await progressCallback(
      "artwork_generation",
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Generate audio from story text with embedded metadata
 */
export async function generateAudioFromStory(
  story: GeneratedStory,
  progressCallback: ProgressCallback,
  metadata?: GeneratedMetadata,
  artworkBuffer?: Buffer,
  customization?: StoryCustomization
): Promise<GeneratedAudio> {
  try {
    await progressCallback("audio_generation", "running");

    const SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;

    if (!SPEECHIFY_API_KEY) {
      throw new Error("Speechify API key not configured");
    }

    console.log("Generating audio with Speechify...");

    const { SpeechifyTTSProvider } = await import('./speechify-tts');
    const ttsProvider = new SpeechifyTTSProvider(SPEECHIFY_API_KEY);

    const ttsResponse = await ttsProvider.synthesizeSpeech({
      text: story.text,
      format: 'mp3',
      voice: process.env.SPEECHIFY_VOICE_ID || 'scott',
      language: 'en', // Default to English for sleep stories
      // Legacy ElevenLabs parameters (ignored by Speechify)
      stability: 0.5,
      similarity_boost: 0.8,
    });

    let audioBuffer = Buffer.from(ttsResponse.audioData, 'base64');

    // Embed metadata if provided
    if (metadata) {
      console.log("Embedding MP3 metadata and artwork...");

      const mp3Metadata = createStoryMetadata(
        metadata.title,
        metadata.description,
        customization
      );

      // Add artwork if provided
      if (artworkBuffer) {
        mp3Metadata.artworkBuffer = artworkBuffer;
        mp3Metadata.artworkMimeType = "image/png";
      }

      // Embed the metadata
      const taggedAudioBuffer = await embedMP3Metadata(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Buffer.from(audioBuffer) as any,
        mp3Metadata
      );
      audioBuffer = Buffer.from(taggedAudioBuffer);
    }

    // Upload to S3
    const s3Key = `sleep-stories/${story.episodeId}/${story.episodeId}-audio.mp3`;
    const audioUrl = await uploadToS3(s3Key, audioBuffer, "audio/mpeg");

    await progressCallback("audio_generation", "completed");

    return {
      audioUrl,
      episodeId: story.episodeId,
    };
  } catch (error) {
    console.error("Error generating audio:", error);
    await progressCallback(
      "audio_generation",
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Complete generation workflow - orchestrates all steps
 */
export async function generateCompleteStory(
  customization: StoryCustomization,
  jobId: string
): Promise<{
  story: GeneratedStory;
  metadata: GeneratedMetadata;
  artwork: GeneratedArtwork;
  audio: GeneratedAudio;
}> {
  const progressCallback: ProgressCallback = async (step, status, error) => {
    try {
      await progressOperations.updateStatus(
        jobId,
        step as "story" | "metadata" | "artwork" | "audio",
        status as "pending" | "processing" | "completed" | "failed",
        error
      );
      console.log(
        `Progress update: ${step} - ${status}`,
        error ? `Error: ${error}` : ""
      );
    } catch (err) {
      console.error("Error updating job progress:", err);
    }
  };

  console.log(`Starting complete story generation for job ${jobId}`);

  // Step 1: Generate story (must complete first)
  const story = await retryGeneration(
    "Story Generation",
    () => generateCustomStory(customization, jobId, progressCallback),
    async (attempts) => {
      console.error(
        `Story generation failed after ${attempts} attempts for job ${jobId}`
      );
    }
  );

  // Step 2: Generate metadata (needed for artwork and audio)
  const finalMetadata = await retryGeneration("Metadata Generation", () =>
    generateMetadataFromStory(story, progressCallback)
  );

  // Step 3: Generate artwork
  const artwork = await retryGeneration("Artwork Generation", () =>
    generateArtworkFromStory(story, finalMetadata, progressCallback)
  );

  // Step 4: Fetch artwork buffer for embedding
  let artworkBuffer: Buffer | undefined;
  if (artwork.imageUrl) {
    try {
      const artworkResponse = await fetch(artwork.imageUrl);
      if (artworkResponse.ok) {
        artworkBuffer = Buffer.from(await artworkResponse.arrayBuffer());
      } else {
        console.warn(
          `Failed to fetch artwork for embedding: ${artworkResponse.statusText}`
        );
      }
    } catch (err) {
      console.warn("Could not fetch artwork for MP3 embedding:", err);
    }
  }

  // Step 5: Generate audio with embedded metadata and artwork
  const audio = await retryGeneration("Audio Generation", () =>
    generateAudioFromStory(
      story,
      progressCallback,
      finalMetadata,
      artworkBuffer,
      customization
    )
  );

  // Save all assets to database
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("generated_assets").insert({
        job_id: jobId,
        episode_id: story.episodeId,
        story_text: story.text,
        title: finalMetadata.title,
        description: finalMetadata.description,
        artwork_url: artwork.imageUrl,
        artwork_prompt: artwork.prompt,
        audio_url: audio.audioUrl,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error saving assets to database:", error);
    }
  } else {
    console.warn("Supabase not configured - assets not saved to database");
  }

  console.log(`Complete story generation finished for job ${jobId}`);

  return {
    story,
    metadata: finalMetadata,
    artwork,
    audio,
  };
}
