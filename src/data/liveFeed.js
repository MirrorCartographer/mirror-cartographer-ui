import { episodeBacklog } from './episodeBacklog';
import { mutationWords as baseMutationWords, seedCapsules as baseSeedCapsules, transitions as baseTransitions } from './creationFeed';

export const seedCapsules = [...episodeBacklog, ...baseSeedCapsules];

export const transitions = {
  'episode-003-ocean-static-radio': ['shoreline-synth-aquarium', 'bad-girl-orchestra-lab', 'mural-that-remixes-you'],
  'shoreline-synth-aquarium': ['ocean-terminal', 'episode-003-ocean-static-radio', 'room-that-sings-back'],
  'bad-girl-orchestra-lab': ['chorus-engine-room', 'static-carnival', 'ash-pop-cathedral'],
  'mural-that-remixes-you': ['animated-afterimage-theater', 'afterimage-orchard', 'mirrorstorm-drive-in'],
  ...baseTransitions
};

export const mutationWords = [
  ...baseMutationWords,
  'radio',
  'tide',
  'orchestra',
  'mural',
  'signal'
];

export const liveCapsules = seedCapsules;
export const liveTransitions = transitions;
export const liveMutationWords = mutationWords;
