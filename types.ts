
export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export type Emotion = 'joy' | 'empathy' | 'calm' | 'curiosity' | 'frustration' | 'surprise' | 'boredom' | 'default';
