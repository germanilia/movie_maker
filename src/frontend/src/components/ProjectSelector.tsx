import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Card,
  CardBody,
  Button,
  Text,
  useColorModeValue,
  Input,
  FormControl,
  FormLabel,
  useToast,
  Divider,
  SimpleGrid,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';

interface ProjectSelectorProps {
  onProjectSelect: (projectName: string) => void;
  onNewProject: () => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onProjectSelect,
  onNewProject,
}) => {
  const [projects, setProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:8000/api/list-projects');
        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        console.log('Projects received:', data); // Debug log
        setProjects(data.projects || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch projects',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [toast]);

  if (isLoading) {
    return (
      <Center height="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box maxW="1200px" mx="auto" p={8}>
      <VStack spacing={8} align="stretch">
        <Heading size="lg" textAlign="center">
          Select a Project
        </Heading>
        <Divider />
        
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          <Card
            onClick={onNewProject}
            cursor="pointer"
            _hover={{ transform: 'scale(1.02)', transition: 'transform 0.2s' }}
            bg={cardBg}
            borderColor={borderColor}
            borderWidth="1px"
          >
            <CardBody>
              <VStack spacing={4} align="center" justify="center" height="150px">
                <AddIcon boxSize={8} />
                <Text fontSize="lg" fontWeight="bold">
                  Create New Project
                </Text>
              </VStack>
            </CardBody>
          </Card>

          {projects.map((project) => (
            <Card
              key={project}
              onClick={() => onProjectSelect(project)}
              cursor="pointer"
              _hover={{ transform: 'scale(1.02)', transition: 'transform 0.2s' }}
              bg={cardBg}
              borderColor={borderColor}
              borderWidth="1px"
            >
              <CardBody>
                <VStack spacing={4} align="center" justify="center" height="150px">
                  <Text fontSize="lg" fontWeight="bold">
                    {project}
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default ProjectSelector; 