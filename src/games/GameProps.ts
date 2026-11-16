export interface GameProps {
  paused: boolean;
  onScore: (score: number, completed?: boolean) => void;
}
