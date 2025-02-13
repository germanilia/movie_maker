import React, { useState, useEffect } from 'react';
import { Box, Text, Button, HStack, useToast } from '@chakra-ui/react';

interface NarrationBoxProps {
  narrationText: string;
  projectName: string;
  chapter: number;
  scene: number;
}

const NarrationBox: React.FC<NarrationBoxProps> = ({ narrationText, projectName, chapter, scene }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const checkExistingNarration = async () => {
      try {
        const response = await fetch(
          `/api/check-narration/${projectName}?chapter_number=${chapter}&scene_number=${scene}`
        );

        if (response.ok && response.status !== 404) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
      } catch (error) {
        console.error('Error checking existing narration:', error);
      }
    };

    checkExistingNarration();

    // Cleanup function to revoke object URL
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [projectName, chapter, scene]);

  const handleGenerateAudio = async () => {
    setIsLoading(true);
    try {
    const response = await fetch(`/api/generate-narration/${projectName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: narrationText, chapter_number: chapter, scene_number: scene }),
    });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
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
      <Text fontWeight="bold" mb={2}>Narration:</Text>
      <Text color="purple.800" mb={4}>{narrationText}</Text>
      
      <HStack spacing={4}>
        <Button
          colorScheme="purple"
          isLoading={isLoading}
          onClick={handleGenerateAudio}
        >
          Generate Audio
        </Button>
        
        {audioUrl && (
          <audio controls>
            <source src={audioUrl} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        )}
      </HStack>
    </Box>
  );
};

export default NarrationBox;