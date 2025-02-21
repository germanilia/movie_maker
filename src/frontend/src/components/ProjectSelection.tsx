import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  useToast,
  Card,
  CardBody,
  SimpleGrid,
  Center,
  Spinner,
  Icon as ChakraIcon,
  useColorModeValue,
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { FaFolder } from 'react-icons/fa';
import ProjectDetailsForm from './ProjectDetailsForm';

interface ProjectSelectionProps {
  onNext: () => void;
  setProjectName: (name: string) => void;
  setCurrentStep: (step: number) => void;
  setScript: (script: any) => void;
}

const ProjectSelection: React.FC<ProjectSelectionProps> = ({ 
  onNext, 
  setProjectName, 
  setCurrentStep,
  setScript 
}) => {
  const [projects, setProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const toast = useToast();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:8000/api/list-projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch projects',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = () => {
    setProjectName('');
    setScript(null);
    setShowProjectForm(true);
  };

  const handleSelectProject = async (projectName: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:8000/api/get-script/${projectName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch script');
      }
      const scriptData = await response.json();
      setScript(scriptData);
      setProjectName(projectName);
      onNext();
      setCurrentStep(2);
    } catch (error) {
      console.error('Error fetching script:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showProjectForm) {
    return (
      <ProjectDetailsForm
        onNext={onNext}
        setScript={setScript}
        setProjectName={setProjectName}
      />
    );
  }

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={10}>
        <VStack spacing={8} align="stretch">
          <Heading size="xl" textAlign="center">
            Video Creator Projects
          </Heading>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
            {/* New Project Card */}
            <Card
              as="button"
              onClick={handleCreateProject}
              cursor="pointer"
              _hover={{ transform: 'scale(1.02)', shadow: 'lg' }}
              transition="all 0.2s"
              height="200px"
              bg={cardBg}
              borderColor={borderColor}
              borderWidth={1}
            >
              <CardBody>
                <Center height="100%">
                  <VStack spacing={4}>
                    <AddIcon boxSize={8} color="green.500" />
                    <Text fontSize="lg" fontWeight="bold">
                      Create New Project
                    </Text>
                  </VStack>
                </Center>
              </CardBody>
            </Card>

            {/* Existing Project Cards */}
            {projects.map((project) => (
              <Card
                key={project}
                as="button"
                onClick={() => handleSelectProject(project)}
                cursor="pointer"
                _hover={{ transform: 'scale(1.02)', shadow: 'lg' }}
                transition="all 0.2s"
                height="200px"
                bg={cardBg}
                borderColor={borderColor}
                borderWidth={1}
              >
                <CardBody>
                  <Center height="100%">
                    <VStack spacing={4}>
                      <ChakraIcon as={FaFolder} boxSize={8} color="blue.500" />
                      <Text fontSize="lg" fontWeight="bold">
                        {project}
                      </Text>
                    </VStack>
                  </Center>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
};

export default ProjectSelection; 