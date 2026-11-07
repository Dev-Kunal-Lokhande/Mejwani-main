export const playNotificationVoice = (text) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }

    const voices = window.speechSynthesis.getVoices();

    const selectedVoice =
      voices.find(
        v =>
          v.lang === "hi-IN" &&
          (
            v.name.includes("Google हिन्दी") ||
            v.name.includes("Female")
          )
      ) || voices.find(v => v.lang === "hi-IN");

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "hi-IN";
    utterance.voice = selectedVoice;
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      resolve();
    };
    utterance.onerror = () => {
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
};
