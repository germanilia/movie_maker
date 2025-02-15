import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  useToast,
  Select,
} from '@chakra-ui/react';

interface ShotVideoProps {
  projectName: string;
  chapterNumber: number;
  sceneNumber: number;
  shotNumber: number;
  shotDescription: string;
  existingVideo?: string;
  onVideoGenerated?: () => Promise<void>;
}

const ShotVideo: React.FC<ShotVideoProps> = ({
  projectName,
  chapterNumber,
  sceneNumber,
  shotNumber,
  shotDescription,
  existingVideo,
  onVideoGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("runwayml");
  const [frameMode, setFrameMode] = useState<string>("both");
  const toast = useToast();

  useEffect(() => {
    if (existingVideo) {
      loadVideo(existingVideo);
    }
  }, [existingVideo]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const loadVideo = async (videoPath: string) => {
    try {
      const videoResponse = await fetch(videoPath);
      if (videoResponse.ok) {
        const blob = await videoResponse.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    }
  };

  const handleGenerateVideo = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-shot-video/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: shotDescription,
            chapter_number: chapterNumber,
            scene_number: sceneNumber,
            shot_number: shotNumber,
            overwrite: true,
            provider: provider,
            frame_mode: frameMode,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      
      toast({
        title: 'Success',
        description: 'Video generated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Notify parent component to refresh videos data
      if (onVideoGenerated) {
        await onVideoGenerated();
      }
    } catch (error) {
      console.error('Error generating video:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate video',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <VStack spacing={4} align="stretch" w="100%">
      <Box>
        <Select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          mb={2}
        >
          <option value="runwayml">RunwayML (Gen3)</option>
          <option value="replicate">Replicate (Kling)</option>
        </Select>
        <Select
          value={frameMode}
          onChange={(e) => setFrameMode(e.target.value)}
          mb={2}
        >
          <option value="both">Use Both Frames (not supported by kling)</option>
          <option value="opening">Use Opening Frame Only</option>
          <option value="closing">Use Closing Frame Only</option>
        </Select>
        <Button
          colorScheme="teal"
          onClick={handleGenerateVideo}
          isLoading={isGenerating}
          loadingText="Generating"
          w="100%"
          mb={2}
        >
          Generate Video
        </Button>
        
        {videoUrl ? (
          <Box>
            <video
              controls
              width="100%"
              key={`${chapterNumber}-${sceneNumber}-${shotNumber}-${videoUrl}`}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </Box>
        ) : (
          <Text color="gray.500" textAlign="center">
            No video generated yet
          </Text>
        )}
      </Box>
    </VStack>
  );
};

export default ShotVideo;