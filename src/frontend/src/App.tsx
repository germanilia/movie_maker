import React, { useState } from 'react';
import { ChakraProvider, Box, Container, extendTheme } from '@chakra-ui/react';
import ProjectSelection from './components/ProjectSelection';
import ScriptGeneration from './components/ScriptGeneration';
import ScriptReview from './components/ScriptReview';
import { Script } from './models/models';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
});

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [script, setScript] = useState<Script | null>(null);
  const [projectName, setProjectName] = useState('');

  const handleNext = () => {
    // Don't increment step here as it's handled by the components
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleHome = () => {
    setCurrentStep(0);
    setScript(null);
    setProjectName('');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <ProjectSelection 
            onNext={handleNext} 
            setProjectName={setProjectName} 
            setCurrentStep={setCurrentStep}
            setScript={setScript}
          />
        );
      case 1:
        return (
          <ScriptGeneration 
            script={script} 
            setScript={setScript} 
            onNext={handleNext} 
            onBack={handleBack} 
            projectName={projectName}
            onHome={handleHome}
          />
        );
      case 2:
        return (
          <ScriptReview
            script={script}
            setScript={setScript}
            onNext={handleNext}
            onBack={handleBack}
            projectName={projectName}
            onHome={handleHome}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" w="100%" bg="gray.50">
        <Container maxW="container.xl" py={8}>
          {renderStep()}
        </Container>
      </Box>
    </ChakraProvider>
  );
};

export default App;