import React from 'react';
import { Script } from '../models/models';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  UnorderedList,
  ListItem,
} from '@chakra-ui/react';

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
  projectName
}) => {
  if (!script) {
    return (
      <Box p={4}>
        <Text>No script available. Please go back and generate a script first.</Text>
        <Button onClick={onBack}>Back</Button>
      </Box>
    );
  }

  return (
    <Box height="100vh" overflow="hidden" position="relative">
      {/* Top Navigation Bar */}
      <Box 
        p={4} 
        borderBottomWidth={1} 
        bg="white" 
        position="sticky" 
        top={0} 
        zIndex={3}
        height="72px"
      >
        <HStack justify="space-between" align="center">
          <Heading size="lg">Script Review</Heading>
          <HStack spacing={4}>
            <Button onClick={onBack}>Back</Button>
            <Button colorScheme="blue" onClick={onNext}>
              Next
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box 
        position="relative"
        height="calc(100vh - 72px)" 
        overflowY="auto" 
        css={{
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
          },
        }}
      >
        <Box p={4} pb={32}>
          <Accordion allowMultiple defaultIndex={[]}>
            {script.chapters.map((chapter, chapterIndex) => (
              <AccordionItem key={chapterIndex}>
                <AccordionButton py={4}>
                  <HStack flex="1" justify="space-between">
                    <Heading size="md">
                      Chapter {chapter.chapter_number}: {chapter.chapter_title}
                    </Heading>
                    <AccordionIcon />
                  </HStack>
                </AccordionButton>
                
                <AccordionPanel pb={6}>
                  <VStack spacing={6} align="stretch">
                    <Box bg="gray.50" p={4} borderRadius="md">
                      <Text color="gray.700">{chapter.chapter_description}</Text>
                    </Box>
                    
                    <Accordion allowMultiple defaultIndex={[]}>
                      {chapter.scenes?.map((scene, sceneIndex) => (
                        <AccordionItem 
                          key={sceneIndex} 
                          border="1px solid"
                          borderColor="gray.200"
                          borderRadius="lg"
                          mb={4}
                        >
                          <AccordionButton py={3}>
                            <HStack flex="1" justify="space-between">
                              <Heading size="sm">Scene {scene.scene_number}</Heading>
                              <AccordionIcon />
                            </HStack>
                          </AccordionButton>

                          <AccordionPanel pb={4}>
                            <VStack align="stretch" spacing={6}>
                              {/* Scene Info */}
                              <Box bg="blue.50" p={4} borderRadius="md">
                                <Text fontWeight="bold" mb={2}>Main Story:</Text>
                                {Array.isArray(scene.main_story) ? (
                                  <UnorderedList>
                                    {scene.main_story.map((story, idx) => (
                                      <ListItem key={idx} color="blue.800">{story}</ListItem>
                                    ))}
                                  </UnorderedList>
                                ) : (
                                  <Text color="blue.800">{scene.main_story}</Text>
                                )}
                              </Box>

                              {/* Scene Reasoning */}
                              {scene.reasoning && (
                                <Box bg="green.50" p={4} borderRadius="md">
                                  <Text fontWeight="bold" mb={2}>Scene Reasoning:</Text>
                                  <Text color="green.800">{scene.reasoning}</Text>
                                </Box>
                              )}

                              {/* Narration */}
                              <Box bg="purple.50" p={4} borderRadius="md">
                                <Text fontWeight="bold" mb={2}>Narration:</Text>
                                <Text color="purple.800">{scene.narration_text}</Text>
                              </Box>

                              {/* Shots */}
                              {scene.shots?.map((shot, shotIndex) => (
                                <Box 
                                  key={shotIndex}
                                  borderWidth="1px"
                                  borderRadius="md"
                                  p={4}
                                  bg="white"
                                >
                                  <VStack spacing={4} align="stretch">
                                    <Heading size="xs">Shot {shot.shot_number}</Heading>
                                    
                                    {/* Shot Reasoning */}
                                    {shot.reasoning && (
                                      <Box bg="yellow.50" p={3} borderRadius="md">
                                        <Text fontWeight="bold" mb={1}>Shot Reasoning:</Text>
                                        <Text color="yellow.800">{shot.reasoning}</Text>
                                      </Box>
                                    )}

                                    {/* Director Instructions */}
                                    <Box bg="blue.50" p={3} borderRadius="md">
                                      <Text fontWeight="bold" mb={1}>Director Instructions:</Text>
                                      <Text color="blue.800">{shot.director_instructions || 'No director instructions available'}</Text>
                                    </Box>

                                    {/* Opening Scene Description */}
                                    {shot.detailed_opening_scene_description && (
                                      <Box bg="teal.50" p={3} borderRadius="md">
                                        <Text fontWeight="bold" mb={1}>Opening Scene Description:</Text>
                                        <Text color="teal.800">{shot.detailed_opening_scene_description}</Text>
                                      </Box>
                                    )}

                                    {/* Closing Scene Description */}
                                    {shot.detailed_closing_scene_description && (
                                      <Box bg="pink.50" p={3} borderRadius="md">
                                        <Text fontWeight="bold" mb={1}>Closing Scene Description:</Text>
                                        <Text color="pink.800">{shot.detailed_closing_scene_description}</Text>
                                      </Box>
                                    )}

                                    {/* Sound Effects */}
                                    {shot.sound_effects && (
                                      <Box bg="orange.50" p={3} borderRadius="md">
                                        <Text fontWeight="bold" mb={1}>Sound Effects:</Text>
                                        {Array.isArray(shot.sound_effects) ? (
                                          <UnorderedList>
                                            {shot.sound_effects.map((effect, idx) => (
                                              <ListItem key={idx} color="orange.800">{effect}</ListItem>
                                            ))}
                                          </UnorderedList>
                                        ) : (
                                          <Text color="orange.800">{shot.sound_effects}</Text>
                                        )}
                                      </Box>
                                    )}
                                  </VStack>
                                </Box>
                              ))}
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
        </Box>
      </Box>
    </Box>
  );
};

export default ScriptReview;
