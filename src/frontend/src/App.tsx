import React, { useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import ProjectDetailsForm from './components/ProjectDetailsForm';
import VideoPreview from './components/VideoPreview';
import ScriptReview from './components/ScriptReview';
import { Script } from './models/models';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [script, setScript] = useState<Script | null>(null);

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ProjectDetailsForm
            onNext={handleNext}
            setScript={setScript}
            setProjectName={setProjectName}
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
          />
        );
      case 3:
        return (
          <VideoPreview
            script={script}
            projectName={projectName}
            onBack={handleBack}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <ChakraProvider>
      {renderStep()}
    </ChakraProvider>
  );
};

export default App;