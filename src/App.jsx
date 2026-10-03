import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useGame } from './state/GameContext';
import { Portal, OutOfLivesModal } from './components/UI';
import { sound } from './audio/soundManager';
import Landing from './screens/Landing';
import GameMap from './screens/GameMap';
import LevelScreen from './screens/LevelScreen';
import Reward from './screens/Reward';
import KissScreen from './screens/KissScreen';
import Finale from './screens/Finale';

const SCREENS = { landing: Landing, map: GameMap, level: LevelScreen, reward: Reward, kiss: KissScreen, finale: Finale };

export default function App() {
  const { screen } = useGame();
  const Screen = SCREENS[screen] ?? Landing;

  useEffect(() => sound.preload(), []);

  // Background music: soft loop on landing / map / kiss; quiet in levels; off for reward + finale
  useEffect(() => {
    if (screen === 'landing' || screen === 'map' || screen === 'kiss') {
      sound.playBgm();
      sound.duckBgm(false);
    } else if (screen === 'level') {
      sound.duckBgm(true);
    } else {
      sound.pauseBgm();
    }
  }, [screen]);

  return (
    <div className="app-root">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={screen}
          className="screen"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35 }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
      <OutOfLivesModal />
      <Portal />
    </div>
  );
}
