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
  Card,
  CardBody,
  useColorModeValue,
  Badge,
  Text,
  Divider,
  Progress,
  IconButton,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
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

const TOTAL_STEPS = 3;

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({
  onNext,
  setScript,
  setProjectName,
}): JSX.Element => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(1);
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

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

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

  const handleChange = (field: string, value: any) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
    if (field === 'project') {
      setProjectName(value);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return projectData.project.trim() !== '' && 
               projectData.genre.trim() !== '' && 
               projectData.subject.trim() !== '';
      case 2:
        return true; // Content instructions are optional
      case 3:
        return projectData.number_of_chapters >= 1 && 
               projectData.number_of_scenes >= 1 && 
               projectData.number_of_shots >= 1;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    } else if (isStepValid()) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card shadow="sm" borderWidth="1px" borderColor={borderColor}>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading size="md">Basic Information</Heading>
                <Divider />
                <FormControl isRequired>
                  <FormLabel fontWeight="bold">Project Name</FormLabel>
                  <Input
                    value={projectData.project}
                    onChange={(e) => handleChange('project', e.target.value)}
                    placeholder="Enter project name"
                    size="lg"
                    bg={bgColor}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontWeight="bold">Genre</FormLabel>
                  <Select
                    value={projectData.genre}
                    onChange={(e) => handleChange('genre', e.target.value)}
                    size="lg"
                    bg={bgColor}
                  >
                    <option value="documentary">Documentary</option>
                    <option value="drama">Drama</option>
                    <option value="comedy">Comedy</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontWeight="bold">Subject</FormLabel>
                  <Input
                    value={projectData.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    placeholder="Enter the main subject of your video"
                    size="lg"
                    bg={bgColor}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>
        );
      case 2:
        return (
          <Card shadow="sm" borderWidth="1px" borderColor={borderColor}>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading size="md">Content Instructions</Heading>
                <Divider />
                <FormControl>
                  <FormLabel fontWeight="bold">Special Instructions</FormLabel>
                  <Textarea
                    value={projectData.movie_general_instructions}
                    onChange={(e) => handleChange('movie_general_instructions', e.target.value)}
                    placeholder="Enter any special instructions for the video"
                    size="lg"
                    minH="120px"
                    bg={bgColor}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontWeight="bold">Story Background</FormLabel>
                  <Textarea
                    value={projectData.story_background}
                    onChange={(e) => handleChange('story_background', e.target.value)}
                    placeholder="Enter background information for the story"
                    size="lg"
                    minH="120px"
                    bg={bgColor}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontWeight="bold">Narration Instructions</FormLabel>
                  <Textarea
                    value={projectData.narration_instructions}
                    onChange={(e) => handleChange('narration_instructions', e.target.value)}
                    placeholder="Enter instructions for the narration style and tone"
                    size="lg"
                    minH="120px"
                    bg={bgColor}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>
        );
      case 3:
        return (
          <Card shadow="sm" borderWidth="1px" borderColor={borderColor}>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading size="md">Structure Settings</Heading>
                <Divider />
                <FormControl isRequired>
                  <FormLabel fontWeight="bold">Number of Chapters</FormLabel>
                  <NumberInput
                    value={projectData.number_of_chapters}
                    onChange={(valueString) => handleChange('number_of_chapters', parseInt(valueString))}
                    min={1}
                    max={10}
                    size="lg"
                  >
                    <NumberInputField bg={bgColor} />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontWeight="bold">Number of Scenes per Chapter</FormLabel>
                  <NumberInput
                    value={projectData.number_of_scenes}
                    onChange={(valueString) => handleChange('number_of_scenes', parseInt(valueString))}
                    min={1}
                    max={10}
                    size="lg"
                  >
                    <NumberInputField bg={bgColor} />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontWeight="bold">Number of Shots per Scene</FormLabel>
                  <NumberInput
                    value={projectData.number_of_shots}
                    onChange={(valueString) => handleChange('number_of_shots', parseInt(valueString))}
                    min={1}
                    max={10}
                    size="lg"
                  >
                    <NumberInputField bg={bgColor} />
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
            </CardBody>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Box height="100vh" overflow="hidden" bg={bgColor}>
      {/* Fixed Header */}
      <Box 
        position="fixed" 
        top={0} 
        left={0} 
        right={0} 
        zIndex={100}
        bg={bgColor}
        borderBottomWidth={1}
        borderColor={borderColor}
      >
        <VStack spacing={0}>
          <HStack 
            justify="space-between" 
            align="center" 
            p={4} 
            width="100%"
            height="72px"
          >
            <HStack spacing={4}>
              <Heading size="lg">Project Details</Heading>
              <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                Step {currentStep} of {TOTAL_STEPS}
              </Badge>
            </HStack>
          </HStack>
          <Progress
            value={(currentStep / TOTAL_STEPS) * 100}
            size="xs"
            colorScheme="blue"
            width="100%"
          />
        </VStack>
      </Box>

      {/* Main Content */}
      <Box 
        height="calc(100vh - 72px)" 
        overflow="auto" 
        pt="72px"
      >
        <VStack 
          spacing={6} 
          align="stretch" 
          maxW="container.md" 
          mx="auto" 
          p={6}
        >
          {renderStepContent()}

          {/* Navigation */}
          <HStack justify="space-between" pt={4}>
            <Button
              leftIcon={<ChevronLeftIcon />}
              onClick={handleBack}
              isDisabled={currentStep === 1}
              size="lg"
              variant="ghost"
            >
              Back
            </Button>
            <Button
              rightIcon={<ChevronRightIcon />}
              onClick={handleNext}
              colorScheme="blue"
              size="lg"
              isLoading={isLoading}
              loadingText={currentStep === TOTAL_STEPS ? "Generating Script" : "Next"}
              isDisabled={!isStepValid()}
            >
              {currentStep === TOTAL_STEPS ? "Generate Script" : "Next"}
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};

export default ProjectDetailsForm;
