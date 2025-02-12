import React, { useState } from 'react';
import {
  ChakraProvider,
  Box,
  Stepper,
  Step,
  StepIndicator,
  StepStatus,
  StepIcon,
  StepNumber,
  StepTitle,
  StepDescription,
  StepSeparator,
  useSteps,
} from '@chakra-ui/react';
import ProjectDetailsForm from './components/ProjectDetailsForm';
import VideoPreview from './components/VideoPreview';
import ScriptReview from './components/ScriptReview';
import ImageReview from './components/ImageReview';

interface ProjectData {
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

interface Script {
  chapters: any[];
  // Add other script properties as needed
}

interface Image {
  url: string;
  chapter_index: number;
  scene_index: number;
  shot_index: number;
}

interface ScriptReviewProps {
  script: Script | null;
  setScript: (script: Script | null) => void;
  onNext: () => void;
  onBack: () => void;
}

const steps = [
  { title: 'Project Details', description: 'Enter project information' },
  { title: 'Script Review', description: 'Review and edit the script' },
  { title: 'Image Review', description: 'Review generated images' },
  { title: 'Video Preview', description: 'Preview final video' },
];

function App() {
  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: steps.length,
  });

  const [projectData, setProjectData] = useState<ProjectData>({
    project: '',
    genre: '',
    subject: '',
    movie_general_instructions: '',
    story_background: '',
    number_of_chapters: 4,
    narration_instructions: '',
    number_of_scenes: 3,
    number_of_shots: 3,
    black_and_white: false,
  });

  const [script, setScript] = useState<Script | null>(null);
  const [images, setImages] = useState<Image[]>([]);

  const handleNext = () => {
    setActiveStep(activeStep + 1);
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <ProjectDetailsForm
            projectData={projectData}
            setProjectData={setProjectData}
            setScript={setScript}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <ScriptReview
            script={script}
            setScript={setScript}
            onNext={handleNext}
            onBack={handleBack}
            projectName={projectData.project}
          />
        );
      case 2:
        return (
          <ImageReview
            images={images}
            setImages={setImages}
            projectName={projectData.project}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <VideoPreview
            projectName={projectData.project}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ChakraProvider>
      <Box height="100vh" display="flex" flexDirection="column" overflow="hidden">
        <Box p={8} bg="white" borderBottomWidth={1} borderBottomColor="gray.200" flexShrink={0}>
          <Stepper index={activeStep}>
            {steps.map((step, index) => (
              <Step key={index}>
                <StepIndicator>
                  <StepStatus
                    complete={<StepIcon />}
                    incomplete={<StepNumber />}
                    active={<StepNumber />}
                  />
                </StepIndicator>
                <Box flexShrink='0'>
                  <StepTitle>{step.title}</StepTitle>
                  <StepDescription>{step.description}</StepDescription>
                </Box>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </Box>

        <Box 
          flex="1" 
          overflow="hidden" 
          position="relative"
          height="calc(100vh - 180px)" // Adjusted to account for header and footer
        >
          {renderStep()}
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App; 