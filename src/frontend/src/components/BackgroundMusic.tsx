import React, { useState } from 'react';
import { Box, Text, UnorderedList, ListItem, Button, HStack, useToast } from '@chakra-ui/react';

interface BackgroundMusicProps {
  backgroundMusic: string | string[] | undefined;  // Made undefined explicit
  projectName: string;
  chapterNumber: number;
  sceneNumber: number;
  isGenerating?: boolean;
  onGenerate?: () => void;
}

const BackgroundMusic: React.FC<BackgroundMusicProps> = ({ 
  backgroundMusic, 
  projectName, 
  chapterNumber, 
  sceneNumber,
  isGenerating,
  onGenerate 
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const toast = useToast();

  const handleGenerateMusic = async () => {
    if (onGenerate) {
      onGenerate();
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-background-music/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: chapterNumber,
            scene_number: sceneNumber,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate background music');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      toast({
        title: 'Success',
        description: 'Background music generated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating background music:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate background music',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (!backgroundMusic) return null;

  return (
    <Box bg="orange.50" p={3} borderRadius="md">
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold">Background Music:</Text>
        <Button
          size="sm"
          colorScheme="orange"
          onClick={handleGenerateMusic}
          isLoading={isGenerating}
          loadingText="Generating"
        >
          Generate Music
        </Button>
      </HStack>
      
      {Array.isArray(backgroundMusic) ? (
        <UnorderedList>
          {backgroundMusic.map((music, idx) => (
            <ListItem key={idx} color="orange.800">{music}</ListItem>
          ))}
        </UnorderedList>
      ) : (
        <Text color="orange.800">{backgroundMusic}</Text>
      )}

      {audioUrl && (
        <Box mt={2}>
          <audio controls src={audioUrl} style={{ width: '100%' }} />
        </Box>
      )}
    </Box>
  );
};

export default BackgroundMusic;