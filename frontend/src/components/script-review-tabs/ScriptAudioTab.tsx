import React, { useState, useEffect } from 'react';
import {
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Box,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import BackgroundMusic from '../BackgroundMusic';
import NarrationBox from '../NarrationBox';
import { fetchSceneData } from '../../services/sceneDataService';

interface ScriptAudioTabProps {
  activeChapterIndex: number;
  activeSceneIndex: number;
  projectName: string;
  cardBg: string;
  bgColor: string;
  borderColor: string;
  narrationText: string;
}

const ScriptAudioTab: React.FC<ScriptAudioTabProps> = ({
  activeChapterIndex,
  activeSceneIndex,
  projectName,
  cardBg,
  bgColor,
  borderColor,
  narrationText,
}) => {
  const toast = useToast();
  const [narrationData, setNarrationData] = useState<Record<string, string>>({});
  const [backgroundMusicData, setBackgroundMusicData] = useState<Record<string, string>>({});
  const [generatingMusic, setGeneratingMusic] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadSceneData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSceneData(projectName, activeChapterIndex, activeSceneIndex);
      setNarrationData(data.narration);
      setBackgroundMusicData(data.backgroundMusic);
    } catch (error) {
      console.error('Error loading scene data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scene audio data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSceneData();
  }, [activeChapterIndex, activeSceneIndex, projectName]);

  const handleGenerateBackgroundMusic = async (style?: string) => {
    const musicKey = `${activeChapterIndex + 1}-${activeSceneIndex + 1}`;
    setGeneratingMusic(prev => new Set(prev).add(musicKey));

    try {
      const response = await fetch(
        `http://localhost:8000/api/generate-background-music/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapter_number: activeChapterIndex + 1,
            scene_number: activeSceneIndex + 1,
            style: style || 'Cinematic',
            overwrite: true
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate background music');
      }

      await loadSceneData();

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
    } finally {
      setGeneratingMusic(prev => {
        const newSet = new Set(prev);
        newSet.delete(musicKey);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Card variant="outline" bg={bgColor}>
        <CardHeader bg={cardBg} borderBottomWidth={1} borderColor={borderColor}>
          <Heading size="sm">Scene Audio</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={6}>
            <Box width="100%">
              <Heading size="xs" mb={4}>Background Music</Heading>
              <BackgroundMusic
                audioData={backgroundMusicData}
                isGenerating={generatingMusic.has(`${activeChapterIndex + 1}-${activeSceneIndex + 1}`)}
                onGenerateMusic={handleGenerateBackgroundMusic}
                chapterIndex={activeChapterIndex}
                sceneIndex={activeSceneIndex}
                projectName={projectName}
              />
            </Box>
            <Box width="100%">
              <Heading size="xs" mb={4}>Narration</Heading>
              <NarrationBox
                audioData={narrationData}
                chapterIndex={activeChapterIndex}
                sceneIndex={activeSceneIndex}
                projectName={projectName}
                narrationText={narrationText}
              />
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default ScriptAudioTab; 