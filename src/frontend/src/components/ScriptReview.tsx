import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Heading,
  VStack,
  HStack,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  Spinner,
  Center,
  Text,
  Select,
} from '@chakra-ui/react';

interface Shot {
  shot_number: number;
  still_image: boolean | string;
  shot_director_instructions: string;
  detailed_opening_scene_description: string;
  detailed_closing_scene_description: string;
}

interface Scene {
  scene_number: number;
  general_scene_description_and_motivations: string;
  key_events: string[];
  main_characters: string[];
  narration_text: string;
  shots: Shot[] | null;
  sound_effects: string[] | string;
}

interface Chapter {
  chapter_number: number;
  chapter_title: string;
  chapter_description: string;
  key_events: string[];
  scenes: Scene[] | null;
}

interface Script {
  chapters: Chapter[];
}

interface ProjectDetails {
  project: string;
  genre: string;
  subject: string;
  movie_general_instructions: string;
  narration_instructions: string;
  story_background: string;
  number_of_chapters: number;
  number_of_scenes: number;
  number_of_shots: number;
  black_and_white: boolean;
}

interface ScriptReviewProps {
  script: Script | null;
  setScript: (script: Script | null) => void;
  onNext: () => void;
  onBack: () => void;
  projectName: string;
}

const SCRIPT_STORAGE_KEY = 'current_script';

const ScriptReview: React.FC<ScriptReviewProps> = ({
  script,
  setScript,
  onNext,
  onBack,
  projectName,
}) => {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Load script from local storage on initial mount
  useEffect(() => {
    const storedScript = localStorage.getItem(SCRIPT_STORAGE_KEY);
    if (storedScript && !script) {
      setScript(JSON.parse(storedScript));
    }
  }, []);

  // Update local storage whenever script changes
  useEffect(() => {
    if (script) {
      localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(script));
    }
  }, [script]);

  const handleChapterChange = (chapterIndex: number, field: string, value: any) => {
    if (!script) return;
    const updatedScript = {
      ...script,
      chapters: script.chapters.map((chapter: any, index: number) =>
        index === chapterIndex ? { ...chapter, [field]: value } : chapter
      ),
    };
    setScript(updatedScript);
  };

  const handleSceneChange = (
    chapterIndex: number,
    sceneIndex: number,
    field: string,
    value: any
  ) => {
    if (!script) return;
    const updatedScript = {
      ...script,
      chapters: script.chapters.map((chapter: any, cIndex: number) =>
        cIndex === chapterIndex
          ? {
            ...chapter,
            scenes: chapter.scenes.map((scene: any, sIndex: number) =>
              sIndex === sceneIndex ? { ...scene, [field]: value } : scene
            ),
          }
          : chapter
      ),
    };
    setScript(updatedScript);
  };

  const handleSave = async () => {
    if (!script) return;
    setIsSaving(true);
    try {
      const response = await fetch(`http://localhost:8000/api/update-script/${projectName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(script),
      });

      if (!response.ok) {
        throw new Error('Failed to save script');
      }

      const updatedScript = await response.json();
      setScript(updatedScript);
      // Update local storage with the server response
      localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(updatedScript));
    } catch (error) {
      console.error('Error saving script:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateShots = async () => {
    if (!script) return;
    setIsGenerating(true);
    try {
      await handleSave(); // First save the script

      // Generate shots
      const generateShotsResponse = await fetch(
        `http://localhost:8000/api/generate_shots/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!generateShotsResponse.ok) {
        const errorData = await generateShotsResponse.json();
        throw new Error(errorData.detail || 'Failed to generate shots');
      }

      const updatedScript = await generateShotsResponse.json();
      setScript(updatedScript);
      localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(updatedScript));

      // Start image generation
      const response = await fetch(
        `http://localhost:8000/api/generate-images/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedScript),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start image generation');
      }

      onNext(); // Proceed to image review page
    } catch (error) {
      console.error('Error generating shots and images:', error);
      // You might want to show an error toast or message to the user here
    } finally {
      setIsGenerating(false);
    }
  };

  if (!script || !script.chapters) {
    return (
      <Center h="100vh">
        <VStack spacing={4}>
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="gray.200"
            color="blue.500"
            size="xl"
          />
          <Text>Loading script...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box height="100vh" overflow="hidden">
      <Box height="calc(100vh - 80px)" overflowY="auto" p={4} pb="100px">
        <VStack spacing={4} align="stretch">
          <Heading size="lg" mb={4}>Script Review</Heading>

          <Accordion allowMultiple defaultIndex={[0]}>
            {script.chapters.map((chapter: any, chapterIndex: number) => (
              <AccordionItem key={chapterIndex}>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Heading size="md">Chapter {chapter.chapter_number}: {chapter.chapter_title}</Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Chapter Title</FormLabel>
                      <Input
                        value={chapter.chapter_title}
                        onChange={(e) =>
                          handleChapterChange(chapterIndex, 'chapter_title', e.target.value)
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Chapter Description</FormLabel>
                      <Textarea
                        value={chapter.chapter_description}
                        onChange={(e) =>
                          handleChapterChange(chapterIndex, 'chapter_description', e.target.value)
                        }
                        rows={4}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Key Events</FormLabel>
                      <Textarea
                        value={chapter.key_events.join('\n')}
                        onChange={(e) =>
                          handleChapterChange(chapterIndex, 'key_events', e.target.value.split('\n'))
                        }
                        rows={3}
                        placeholder="One event per line"
                      />
                    </FormControl>

                    <Accordion allowMultiple>
                      {chapter.scenes.map((scene: any, sceneIndex: number) => (
                        <AccordionItem key={sceneIndex}>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              <Heading size="sm">Scene {scene.scene_number}</Heading>
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>
                          <AccordionPanel>
                            <VStack spacing={4} align="stretch">
                              <FormControl>
                                <FormLabel>Scene Description</FormLabel>
                                <Textarea
                                  value={scene.general_scene_description_and_motivations}
                                  onChange={(e) =>
                                    handleSceneChange(
                                      chapterIndex,
                                      sceneIndex,
                                      'general_scene_description_and_motivations',
                                      e.target.value
                                    )
                                  }
                                  rows={4}
                                />
                              </FormControl>

                              <FormControl>
                                <FormLabel>Key Events</FormLabel>
                                <Textarea
                                  value={scene.key_events.join('\n')}
                                  onChange={(e) =>
                                    handleSceneChange(
                                      chapterIndex,
                                      sceneIndex,
                                      'key_events',
                                      e.target.value.split('\n')
                                    )
                                  }
                                  rows={3}
                                  placeholder="One event per line"
                                />
                              </FormControl>

                              <FormControl>
                                <FormLabel>Main Characters</FormLabel>
                                <Textarea
                                  value={scene.main_characters.join('\n')}
                                  onChange={(e) =>
                                    handleSceneChange(
                                      chapterIndex,
                                      sceneIndex,
                                      'main_characters',
                                      e.target.value.split('\n')
                                    )
                                  }
                                  rows={3}
                                  placeholder="One character per line"
                                />
                              </FormControl>

                              <FormControl>
                                <FormLabel>Narration Text</FormLabel>
                                <Textarea
                                  value={scene.narration_text}
                                  onChange={(e) =>
                                    handleSceneChange(
                                      chapterIndex,
                                      sceneIndex,
                                      'narration_text',
                                      e.target.value
                                    )
                                  }
                                  rows={4}
                                />
                              </FormControl>
                            </VStack>
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </VStack>
      </Box>
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        p={4}
        bg="white"
        borderTopWidth={1}
        shadow="lg"
      >
        <HStack spacing={4} justify="flex-end">
          <Button onClick={onBack}>Back</Button>
          <Button 
            colorScheme="blue" 
            onClick={handleGenerateShots}
            isLoading={isGenerating}
            loadingText="Generating shots..."
          >
            Next
          </Button>
        </HStack>
      </Box>
    </Box>
  );
};

export default ScriptReview;
