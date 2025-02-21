import React, { useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import ProjectDetailsForm from './components/ProjectDetailsForm';
import ScriptReview from './components/ScriptReview';
import ProjectSelector from './components/ProjectSelector';
import { Script } from './models/models';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [script, setScript] = useState<Script | null>(null);

  const handleProjectSelect = async (selectedProject: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/get-script/${selectedProject}`);
      if (!response.ok) {
        throw new Error('Failed to fetch script');
      }
      const scriptData = await response.json();
      setScript(scriptData);
      setProjectName(selectedProject);
      setCurrentStep(2);
    } catch (error) {
      console.error('Error fetching script:', error);
    }
  };

  const handleNewProject = () => {
    setCurrentStep(1);
  };

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <ProjectSelector
            onProjectSelect={handleProjectSelect}
            onNewProject={handleNewProject}
          />
        );
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