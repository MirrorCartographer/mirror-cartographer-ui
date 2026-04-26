import { episodeBacklog } from './episodeBacklog';
import { mutationWords, seedCapsules, transitions } from './creationFeed';

export const liveCapsules = [...episodeBacklog, ...seedCapsules];

export const liveTransitions = {
  'episode-003-ocean-static-radio': ['shoreline-synth-aquarium', 'bad-girl-orchestra-lab', 'mural-that-remixes-you'],
  'shoreline-synth-aquarium': ['ocean-terminal', 'episode-003-ocean-static-radio', 'room-that-sings-back'],
  'bad-girl-orchestra-lab': ['chorus-engine-room', 'static-carnival', 'ash-pop-cathedral'],
  'mural-that-remixes-you': ['animated-afterimage-theater', 'afterimage-orchard', 'mirrorstorm-drive-in'],
  ...transitions
};

export const liveMutationWords = [
  ...mutationWords,
  'radio',
  'tide',
  'orchestra',
  'mural',
  'signal'
];
