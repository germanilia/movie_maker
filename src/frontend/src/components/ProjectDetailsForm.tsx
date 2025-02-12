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

interface ProjectDetailsFormProps {
  projectData: {
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
  };
  setProjectData: (data: any) => void;
  setScript: (script: any) => void;
  onNext: () => void;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({
  projectData,
  setProjectData,
  setScript,
  onNext,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const toast = useToast();

  // Load default data from YAML file if it exists
  React.useEffect(() => {
    localStorage.clear();
    
    // Try to fetch the default data from the YAML file in public/assets
    fetch('/assets/default_data.yaml')
      .then(async response => {
        if (!response.ok) {
          throw new Error('Failed to load default data');
        }
        return response.text();
      })
      .then(text => {
        try {
          const yamlData = yaml.load(text);
          if (yamlData && typeof yamlData === 'object') {
            setProjectData(yamlData);
          } else {
            throw new Error('Invalid YAML data');
          }
        } catch (e) {
          console.error('Error parsing YAML:', e);
          throw e;
        }
      })
      .catch((error) => {
        console.error('Error loading default data:', error);
        // If the file doesn't exist or there's an error, initialize with empty values
        setProjectData({
          project: '',
          genre: '',
          subject: '',
          movie_general_instructions: '',
          story_background: '',
          narration_instructions: '',
          number_of_chapters: 1,
          number_of_scenes: 1,
          number_of_shots: 1,
          black_and_white: false,
        });
      });
  }, [setProjectData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Generate the script
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setProjectData({ ...projectData, [field]: value });
  };

  return (
    <Box height="100vh" overflow="hidden">
      <Box height="calc(100vh - 80px)" overflowY="auto" p={4} pb="100px">
        <VStack spacing={4} align="stretch" maxW="container.md" mx="auto">
          <Heading size="lg" mb={4}>Project Details</Heading>
          
          <FormControl isRequired>
            <FormLabel>Project Name</FormLabel>
            <Input
              value={projectData.project}
              onChange={(e) => handleChange('project', e.target.value)}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Genre</FormLabel>
            <Select
              value={projectData.genre}
              onChange={(e) => handleChange('genre', e.target.value)}
            >
              <option value="documentary">Documentary</option>
              <option value="drama">Drama</option>
              <option value="comedy">Comedy</option>
            </Select>
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Subject</FormLabel>
            <Input
              value={projectData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Special Instructions</FormLabel>
            <Textarea
              value={projectData.movie_general_instructions}
              onChange={(e) => handleChange('movie_general_instructions', e.target.value)}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Story Background</FormLabel>
            <Textarea
              value={projectData.story_background}
              onChange={(e) => handleChange('story_background', e.target.value)}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Narration Instructions</FormLabel>
            <Textarea
              value={projectData.narration_instructions}
              onChange={(e) => handleChange('narration_instructions', e.target.value)}
              placeholder="Enter instructions for the narration style and tone"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Number of Chapters</FormLabel>
            <NumberInput
              value={projectData.number_of_chapters}
              onChange={(value) => handleChange('number_of_chapters', parseInt(value))}
              min={1}
              max={10}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Number of Scenes per Chapter</FormLabel>
            <NumberInput
              value={projectData.number_of_scenes}
              onChange={(value) => handleChange('number_of_scenes', parseInt(value))}
              min={1}
              max={10}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Number of Shots per Scene</FormLabel>
            <NumberInput
              value={projectData.number_of_shots}
              onChange={(value) => handleChange('number_of_shots', parseInt(value))}
              min={1}
              max={10}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <FormControl display="flex" alignItems="center">
            <FormLabel mb="0">Black and White</FormLabel>
            <Switch
              isChecked={projectData.black_and_white}
              onChange={(e) => handleChange('black_and_white', e.target.checked)}
            />
          </FormControl>
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
        borderTopColor="gray.200"
        zIndex={2}
        boxShadow="0 -2px 10px rgba(0,0,0,0.1)"
      >
        <HStack spacing={4} justify="flex-end" maxW="container.md" mx="auto">
          <Button 
            type="submit" 
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
    </Box>
  );
};

export default ProjectDetailsForm; 
