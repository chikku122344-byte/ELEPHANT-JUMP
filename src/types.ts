export enum GameState {
  START,
  PLAYING,
  GAME_OVER,
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface Player extends Entity {
  velocityY: number;
  isJumping: boolean;
}

export interface Obstacle extends Entity {
  speed: number;
}

export interface Peanut extends Entity {
  collected: boolean;
}
