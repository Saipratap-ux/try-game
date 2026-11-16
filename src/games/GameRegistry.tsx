import React from 'react';
import type { GameProps } from './GameProps';
import {
  ColorMatchGame,
  ShapeExplorerGame,
  AnimalSafariGame,
  AlphabetAdventureGame,
  NumberGardenGame,
} from './KidsGames';
import {
  MemoryPairsGame,
  SudokuClassicGame,
  WordSearchGame,
  Sliding15Game,
  PictureMatchGame,
} from './BrainGames';
import {
  TurboRacingGame,
  EndlessRoadGame,
  ParkingChallengeGame,
  BikeRacingGame,
  TrafficDodgeGame,
} from './RacingGames';
import {
  BubbleShooterGame,
  FruitCatcherGame,
  BrickBreakerGame,
  SkyJumperGame,
  SpaceShooterGame,
} from './ArcadeGames';
import {
  ChessMasterGame,
  LudoClassicGame,
  TicTacToeLocalGame,
  ConnectFourLocalGame,
  PenaltyStrikerGame,
  CricketSuperOverGame,
} from './FamilySportsGames';

const REGISTRY: Record<string, React.FC<GameProps>> = {
  'color-match': ColorMatchGame,
  'shape-builder': ShapeExplorerGame,
  'animal-safari': AnimalSafariGame,
  'alphabet-trace': AlphabetAdventureGame,
  'number-garden': NumberGardenGame,
  'memory-flip': MemoryPairsGame,
  'sudoku-classic': SudokuClassicGame,
  'word-search': WordSearchGame,
  'sliding-15': Sliding15Game,
  'picture-match': PictureMatchGame,
  'turbo-gp': TurboRacingGame,
  'endless-highway': EndlessRoadGame,
  'parking-pro': ParkingChallengeGame,
  'moto-sprint': BikeRacingGame,
  'traffic-dodge': TrafficDodgeGame,
  'bubble-pop': BubbleShooterGame,
  'fruit-catcher': FruitCatcherGame,
  'brick-breaker': BrickBreakerGame,
  'sky-jumper': SkyJumperGame,
  'star-blaster': SpaceShooterGame,
  'chess-master': ChessMasterGame,
  'ludo-party': LudoClassicGame,
  'tic-tac-toe': TicTacToeLocalGame,
  'connect-four': ConnectFourLocalGame,
  'penalty-striker': PenaltyStrikerGame,
  'cricket-super-over': CricketSuperOverGame,
};

export const IMPLEMENTED_GAME_IDS = Object.keys(REGISTRY);

export const GameModuleRunner: React.FC<{
  gameId: string;
  gameKey: number;
  paused: boolean;
  onScore: (score: number, completed?: boolean) => void;
}> = ({ gameId, gameKey, paused, onScore }) => {
  const Component = REGISTRY[gameId];
  if (!Component) {
    return (
      <div className="p-8 text-center text-red-500">
        Game module "{gameId}" could not be loaded. Report this issue to SC AI Game Doctor.
      </div>
    );
  }
  return <Component key={gameKey} paused={paused} onScore={onScore} />;
};
