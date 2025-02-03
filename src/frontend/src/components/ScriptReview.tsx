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
  detailed_opening_scene_description: string;
  detailed_opening_scene_description_main_character_presence: boolean | string;
  detailed_closing_scene_description: string;
  detailed_closing_scene_description_main_character_presence: boolean | string;
  detailed_shot_description: string;
  shot_description: string;
}

interface Scene {
  scene_number: number;
  general_scene_description_and_motivations: string;
  key_events: string[];
  main_characters: string[];
  narration_text: string;
  shots: Shot[];
  sound_effects: string[] | string;
}

interface Chapter {
  chapter_number: number;
  chapter_title: string;
  chapter_description: string;
  key_events: string[];
  main_characters: string[];
  scenes: Scene[];
}

interface Script {
  chapters: Chapter[];
}

interface ScriptReviewProps {
  script: Script | null;
  setScript: (script: Script | null) => void;
  onNext: () => void;
  onBack: () => void;
  projectName: string;
}

const ScriptReview: React.FC<ScriptReviewProps> = ({
  script,
  setScript,
  onNext,
  onBack,
  projectName,
}) => {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  useEffect(() => {
    // Debug log to verify script data
    console.log('Script in ScriptReview:', script);
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
    } catch (error) {
      console.error('Error saving script:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!script) return;
    setIsGenerating(true);
    try {
      await handleSave(); // First save the script
      
      // Start image generation
      const response = await fetch(
        `http://localhost:8000/api/generate-images/${projectName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(script),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start image generation');
      }

      onNext(); // Proceed to image review page
    } catch (error) {
      console.error('Error generating images:', error);
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
    <Box>
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

                  <FormControl>
                    <FormLabel>Main Characters</FormLabel>
                    <Textarea
                      value={chapter.main_characters.join('\n')}
                      onChange={(e) =>
                        handleChapterChange(chapterIndex, 'main_characters', e.target.value.split('\n'))
                      }
                      rows={3}
                      placeholder="One character per line"
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

                            <FormControl>
                              <FormLabel>Sound Effects</FormLabel>
                              <Textarea
                                value={Array.isArray(scene.sound_effects) ? scene.sound_effects.join('\n') : scene.sound_effects}
                                onChange={(e) =>
                                  handleSceneChange(
                                    chapterIndex,
                                    sceneIndex,
                                    'sound_effects',
                                    e.target.value.split('\n')
                                  )
                                }
                                rows={3}
                                placeholder="One sound effect per line"
                              />
                            </FormControl>

                            {scene.shots && (
                              <Accordion allowMultiple>
                                {scene.shots.map((shot: any, shotIndex: number) => (
                                  <AccordionItem key={shotIndex}>
                                    <AccordionButton>
                                      <Box flex="1" textAlign="left">
                                        <Heading size="xs">Shot {shot.shot_number}</Heading>
                                      </Box>
                                      <AccordionIcon />
                                    </AccordionButton>
                                    <AccordionPanel>
                                      <VStack spacing={4} align="stretch">
                                        <FormControl>
                                          <FormLabel>Opening Scene Description</FormLabel>
                                          <Textarea
                                            value={shot.detailed_opening_scene_description}
                                            isReadOnly
                                            rows={3}
                                          />
                                        </FormControl>

                                        <FormControl>
                                          <FormLabel>Opening Scene Main Character Presence</FormLabel>
                                          <Select
                                            value={String(shot.detailed_opening_scene_description_main_character_presence)}
                                            isReadOnly
                                          >
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                          </Select>
                                        </FormControl>

                                        <FormControl>
                                          <FormLabel>Closing Scene Description</FormLabel>
                                          <Textarea
                                            value={shot.detailed_closing_scene_description}
                                            isReadOnly
                                            rows={3}
                                          />
                                        </FormControl>

                                        <FormControl>
                                          <FormLabel>Closing Scene Main Character Presence</FormLabel>
                                          <Select
                                            value={String(shot.detailed_closing_scene_description_main_character_presence)}
                                            isReadOnly
                                          >
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                          </Select>
                                        </FormControl>

                                        <FormControl>
                                          <FormLabel>Shot Description</FormLabel>
                                          <Textarea
                                            value={shot.detailed_shot_description}
                                            isReadOnly
                                            rows={3}
                                          />
                                        </FormControl>

                                        <FormControl>
                                          <FormLabel>Still Image</FormLabel>
                                          <Select
                                            value={String(shot.still_image)}
                                            isReadOnly
                                          >
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                          </Select>
                                        </FormControl>
                                      </VStack>
                                    </AccordionPanel>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            )}
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

        <HStack spacing={4} justify="flex-end" mt={4}>
          <Button onClick={onBack}>Back</Button>
          <Button 
            colorScheme="blue" 
            variant="outline"
            onClick={handleSave}
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save Changes
          </Button>
          <Button 
            colorScheme="blue"
            onClick={handleGenerateImages}
            isLoading={isGenerating}
            loadingText="Generating Images..."
          >
            Generate Images
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default ScriptReview; 