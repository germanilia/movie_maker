import React, { useState, useEffect } from 'react';
import { Box, Text, Button, VStack, useToast } from '@chakra-ui/react';

export interface NarrationBoxProps {
  narrationText: string;
  projectName: string;
  chapterNumber: number;
  sceneNumber: number;
  existingNarration?: string;
  audioData?: string; // base64 encoded audio data
}

const NarrationBox: React.FC<NarrationBoxProps> = ({ 
  narrationText, 
  projectName, 
  chapterNumber, 
  sceneNumber,
  existingNarration,
  audioData
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (existingNarration) {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(existingNarration), c => c.charCodeAt(0))],
        { type: 'audio/wav' }
      );
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    }
  }, [existingNarration]);

  useEffect(() => {
    // Convert base64 audio data to blob URL if available
    if (audioData) {
      // Convert base64 to binary
      const binaryStr = atob(audioData);
      // Create an array buffer from the binary string
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      // Create blob from the array buffer
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    }

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioData]);

  const handleGenerateAudio = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/generate-narration/${projectName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: narrationText, 
          chapter_number: chapterNumber, 
          scene_number: sceneNumber 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      toast({
        title: 'Success',
        description: 'Audio narration generated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate audio narration',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      console.error('Error generating audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box bg="purple.50" p={4} borderRadius="md">
      <VStack align="stretch" spacing={4}>
        <Box position="relative">
          <Button
            colorScheme="purple"
            isLoading={isLoading}
            onClick={handleGenerateAudio}
            position="absolute"
            right={0}
            top={-2}
            zIndex={1}
          >
            {audioUrl ? 'Regenerate Audio' : 'Generate Audio'}
          </Button>
          
          <Text fontWeight="bold" mb={2}>Narration:</Text>
          <Text color="purple.800">{narrationText}</Text>
        </Box>
        
        {audioUrl && (
          <Box mt={2}>
            <audio controls style={{ width: '100%' }}>
              <source src={audioUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default NarrationBox;