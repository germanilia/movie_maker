import React from 'react';
import { Script } from '../models/models';
import { Box } from '@chakra-ui/react';

interface ScriptGenerationProps {
  script: Script | null;
  setScript: React.Dispatch<React.SetStateAction<Script | null>>;
  onNext: () => void;
  onBack: () => void;
  projectName: string;
  onHome: () => void;
}

const ScriptGeneration: React.FC<ScriptGenerationProps> = ({
  script,
  setScript,
  onNext,
  onBack,
  projectName,
  onHome
}) => {
  return (
    <Box>
      {/* Your component implementation */}
    </Box>
  );
};

export default ScriptGeneration; 