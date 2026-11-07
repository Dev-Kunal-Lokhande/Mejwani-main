let sharedAudioContext = null;

const getAudioContextClass = () =>
  typeof window !== 'undefined' &&
  (window.AudioContext || window.webkitAudioContext);

export const unlockAudioContext = async () => {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return null;

  if (sharedAudioContext) {
    try {
      if (sharedAudioContext.state === 'suspended') {
        await sharedAudioContext.resume();
      }
    } catch (error) {
      console.warn('Audio resume failed', error);
    }
    return sharedAudioContext;
  }

  try {
    sharedAudioContext = new AudioContextClass();
    if (sharedAudioContext.state === 'suspended') {
      await sharedAudioContext.resume();
    }
    return sharedAudioContext;
  } catch (error) {
    console.warn('Audio unlock failed', error);
    sharedAudioContext = null;
    return null;
  }
};

export const getAudioContext = () => {
  if (!sharedAudioContext) return null;

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch((error) => {
      console.warn('Audio resume failed', error);
    });
  }

  return sharedAudioContext;
};
