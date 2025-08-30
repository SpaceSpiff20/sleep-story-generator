# Speechify TTS Migration Guide

## Overview
This document outlines the migration from ElevenLabs TTS to Speechify TTS API while maintaining backward compatibility.

## Migration Status
✅ **COMPLETED** - All code has been migrated to use Speechify TTS

## Changes Made

### 1. New Dependencies
- Added `@speechify/api` package
- Removed direct ElevenLabs API calls

### 2. Files Modified

#### `lib/speechify-tts.ts` (NEW)
- Created new Speechify TTS provider
- Implements backward compatibility wrapper
- Handles voice management and model selection

#### `lib/generation.ts`
- Updated `generateAudioFromStory()` function
- Replaced ElevenLabs API calls with Speechify
- Maintains same interface and error handling

#### `scripts/generateAudio.ts`
- Updated to use Speechify TTS provider
- Simplified API key requirements (only needs `SPEECHIFY_API_KEY`)

#### `test/speechify-tts.test.ts` (NEW)
- Comprehensive test suite for Speechify integration
- Tests backward compatibility
- Only runs when API key is available

### 3. Environment Variables

#### Removed
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

#### Added
- `SPEECHIFY_API_KEY` (required)
- `SPEECHIFY_VOICE_ID` (optional, defaults to 'scott')

## Backward Compatibility

### Preserved Features
- ✅ MP3 audio format output
- ✅ Text-to-speech functionality
- ✅ Error handling and progress callbacks
- ✅ Metadata embedding
- ✅ S3 upload functionality
- ✅ Voice selection (mapped to Speechify voices)

### Legacy Parameters (Ignored)
- `stability` - ElevenLabs specific, not supported by Speechify
- `similarity_boost` - ElevenLabs specific, not supported by Speechify

### New Features Gained
- ✅ Speech marks for word-level timing
- ✅ Billable character count tracking
- ✅ Multiple audio formats (mp3, wav, ogg, aac)
- ✅ Automatic language detection
- ✅ Loudness normalization
- ✅ Text normalization

## Functionality Comparison

| Feature | ElevenLabs | Speechify | Status |
|---------|------------|-----------|---------|
| Text-to-Speech | ✅ | ✅ | ✅ Migrated |
| MP3 Output | ✅ | ✅ | ✅ Preserved |
| Voice Selection | ✅ | ✅ | ✅ Preserved |
| Multilingual | ✅ | ✅ | ✅ Preserved |
| Voice Settings | ✅ | ❌ | ⚠️ Not Available |
| Voice Cloning | ✅ | ❌ | ❌ Not Available |
| Speech Marks | ❌ | ✅ | ✅ New Feature |
| Character Counting | ❌ | ✅ | ✅ New Feature |
| Multiple Formats | ❌ | ✅ | ✅ New Feature |

## Testing

### Running Tests
```bash
# Run all tests (including Speechify tests if API key is available)
npm test

# Run only Speechify tests
npm test -- --testNamePattern="Speechify"
```

### Test Coverage
- ✅ Basic TTS functionality
- ✅ Multiple audio formats
- ✅ Language support
- ✅ Voice management
- ✅ Backward compatibility
- ✅ Error handling
- ✅ Model selection
- ✅ Speech marks and metadata

## Deployment Checklist

### Environment Setup
1. [ ] Get Speechify API key from https://console.sws.speechify.com/signup
2. [ ] Add `SPEECHIFY_API_KEY` to environment variables
3. [ ] Optionally set `SPEECHIFY_VOICE_ID` (defaults to 'scott')
4. [ ] Remove `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`

### GitHub Actions
1. [ ] Update GitHub Actions secrets
2. [ ] Replace ElevenLabs secrets with Speechify secrets
3. [ ] Test automated episode generation

### Local Development
1. [ ] Update `.env.local` file
2. [ ] Test audio generation locally
3. [ ] Verify all scripts work correctly

## API Key Management

### Getting a Speechify API Key
1. Visit https://console.sws.speechify.com/signup
2. Create an account
3. Generate an API key
4. Add to environment variables

### Voice Selection
- Default voice: `scott`
- Use `getVoices()` method to list available voices
- Voice IDs are different from ElevenLabs

## Error Handling

### Common Issues
1. **Invalid API Key**: Check API key format and permissions
2. **Rate Limiting**: Speechify has different rate limits than ElevenLabs
3. **Voice Not Found**: Use `getVoices()` to find valid voice IDs
4. **Language Not Supported**: Check language support table

### Error Messages
- ElevenLabs errors replaced with Speechify-specific error messages
- Maintains same error handling structure
- Progress callbacks work identically

## Performance Considerations

### API Response Times
- Speechify may have different response times than ElevenLabs
- Test with production load to ensure acceptable performance

### Rate Limits
- Speechify has different rate limiting than ElevenLabs
- Monitor usage and adjust accordingly

### Audio Quality
- Speechify uses different models and voice synthesis
- Test audio quality with sample content
- May need voice selection adjustments

## Rollback Plan

If issues arise, you can rollback by:

1. Reverting the changes in `lib/generation.ts`
2. Reverting the changes in `scripts/generateAudio.ts`
3. Restoring ElevenLabs environment variables
4. Removing `@speechify/api` dependency

## Support

- Speechify API Documentation: Check the `@speechify/api` package
- API Key Management: https://console.sws.speechify.com/signup
- Community Support: Check Speechify's official channels

## Migration Validation

### Pre-Migration Checklist
- [ ] Backup current ElevenLabs configuration
- [ ] Test Speechify API key
- [ ] Verify voice selection works
- [ ] Test audio generation with sample text

### Post-Migration Checklist
- [ ] Verify all tests pass
- [ ] Test complete story generation workflow
- [ ] Verify audio quality meets requirements
- [ ] Test automated generation in GitHub Actions
- [ ] Monitor error rates and performance
- [ ] Update documentation

## Future Enhancements

### Potential Improvements
1. **Voice Customization**: Explore Speechify's voice options
2. **Language Expansion**: Test with more languages
3. **Audio Processing**: Leverage Speechify's audio features
4. **Cost Optimization**: Monitor character usage and optimize

### Monitoring
- Track billable character count
- Monitor API response times
- Watch for rate limiting issues
- Compare audio quality metrics 