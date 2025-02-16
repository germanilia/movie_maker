import React from 'react';
import * as yaml from 'js-yaml';
import {
  Box,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Switch,
  Button,
  VStack,
  Select,
  Heading,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { Script } from '../models/models';

interface ProjectDetailsFormProps {
  onNext: () => void;
  setScript: (script: Script | null) => void;
  setProjectName: (name: string) => void;
}

interface ProjectData {
  project: string;
  genre: string;
  subject: string;
  movie_general_instructions: string;
  story_background: string;
  narration_instructions: string;
  number_of_chapters: number;
  number_of_scenes: number;
  number_of_shots: number;
  black_and_white: boolean;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({
  onNext,
  setScript,
  setProjectName,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [projectData, setProjectData] = React.useState<ProjectData>({
    project: '',
    genre: 'documentary',
    subject: '',
    movie_general_instructions: '',
    story_background: '',
    narration_instructions: '',
    number_of_chapters: 1,
    number_of_scenes: 1,
    number_of_shots: 1,
    black_and_white: false,
  });
  const toast = useToast();

  // Load default data from YAML file if it exists
  React.useEffect(() => {
    localStorage.clear();
    
    fetch('/assets/default_data.yaml')
      .then(async response => {
        if (!response.ok) {
          throw new Error('Failed to load default data');
        }
        return response.text();
      })
      .then(text => {
        try {
          const yamlData = yaml.load(text) as ProjectData;
          if (yamlData) {
            setProjectData(yamlData);
            if (yamlData.project) {
              setProjectName(yamlData.project);
            }
          }
        } catch (e) {
          console.error('Error parsing YAML:', e);
          throw e;
        }
      })
      .catch((error) => {
        console.error('Error loading default data:', error);
      });
  }, [setProjectName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const generateResponse = await fetch('http://localhost:8000/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });
      
      if (!generateResponse.ok) {
        throw new Error('Failed to generate script');
      }
      
      const generateData = await generateResponse.json();
      
      if (generateData.script) {
        setScript(generateData.script);
        onNext();
      } else {
        throw new Error('No script data in response');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate script',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
    if (field === 'project') {
      setProjectName(value);
    }
  };

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
          <Heading size="lg">Project Details</Heading>
          <Button
            colorScheme="blue"
            size="lg"
            isLoading={isLoading}
            loadingText="Generating Script"
            onClick={handleSubmit}
          >
            Generate Script
          </Button>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box height="calc(100vh - 72px)" overflow="auto" p={4}>
        <VStack spacing={6} align="stretch" maxW="container.md" mx="auto">
          <FormControl isRequired>
            <FormLabel fontWeight="bold">Project Name</FormLabel>
            <Input
              bg="white"
              value={projectData.project}
              onChange={(e) => handleChange('project', e.target.value)}
              placeholder="Enter project name"
              size="lg"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel fontWeight="bold">Genre</FormLabel>
            <Select
              bg="white"
              value={projectData.genre}
              onChange={(e) => handleChange('genre', e.target.value)}
              size="lg"
            >
              <option value="documentary">Documentary</option>
              <option value="drama">Drama</option>
              <option value="comedy">Comedy</option>
            </Select>
          </FormControl>

          <FormControl isRequired>
            <FormLabel fontWeight="bold">Subject</FormLabel>
            <Input
              bg="white"
              value={projectData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="Enter the main subject of your video"
              size="lg"
            />
          </FormControl>

          <FormControl>
            <FormLabel fontWeight="bold">Special Instructions</FormLabel>
            <Textarea
              bg="white"
              value={projectData.movie_general_instructions}
              onChange={(e) => handleChange('movie_general_instructions', e.target.value)}
              placeholder="Enter any special instructions for the video"
              size="lg"
              minH="120px"
            />
          </FormControl>

          <FormControl>
            <FormLabel fontWeight="bold">Story Background</FormLabel>
            <Textarea
              bg="white"
              value={projectData.story_background}
              onChange={(e) => handleChange('story_background', e.target.value)}
              placeholder="Enter background information for the story"
              size="lg"
              minH="120px"
            />
          </FormControl>

          <FormControl>
            <FormLabel fontWeight="bold">Narration Instructions</FormLabel>
            <Textarea
              bg="white"
              value={projectData.narration_instructions}
              onChange={(e) => handleChange('narration_instructions', e.target.value)}
              placeholder="Enter instructions for the narration style and tone"
              size="lg"
              minH="120px"
            />
          </FormControl>

          <Box
            p={6}
            bg="gray.50"
            borderRadius="md"
            borderWidth="1px"
            borderColor="gray.200"
          >
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontWeight="bold">Number of Chapters</FormLabel>
                <NumberInput
                  bg="white"
                  value={projectData.number_of_chapters}
                  onChange={(valueString) => handleChange('number_of_chapters', parseInt(valueString))}
                  min={1}
                  max={10}
                  size="lg"
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontWeight="bold">Number of Scenes per Chapter</FormLabel>
                <NumberInput
                  bg="white"
                  value={projectData.number_of_scenes}
                  onChange={(valueString) => handleChange('number_of_scenes', parseInt(valueString))}
                  min={1}
                  max={10}
                  size="lg"
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontWeight="bold">Number of Shots per Scene</FormLabel>
                <NumberInput
                  bg="white"
                  value={projectData.number_of_shots}
                  onChange={(valueString) => handleChange('number_of_shots', parseInt(valueString))}
                  min={1}
                  max={10}
                  size="lg"
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0" fontWeight="bold">Black and White</FormLabel>
                <Switch
                  size="lg"
                  isChecked={projectData.black_and_white}
                  onChange={(e) => handleChange('black_and_white', e.target.checked)}
                />
              </FormControl>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
};

export default ProjectDetailsForm;
