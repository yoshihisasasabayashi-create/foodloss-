export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryMessage {
  id: string;
  text: string;
  timestamp: string; // Transmitted as ISO string via JSON
  type: 'system' | 'ai';
}

export enum UserRole {
  DRIVER = 'DRIVER',
  CUSTOMER = 'CUSTOMER',
}

export interface TrackingSession {
  isActive: boolean;
  startTime: Date | null;
  deliveryId: string;
}

export type P2PData = 
  | { type: 'LOCATION_UPDATE'; payload: Coordinates }
  | { type: 'MESSAGE_ADD'; payload: DeliveryMessage }
  | { type: 'SESSION_END' }
  | { type: 'SYNC_STATE'; payload: { coordinates: Coordinates | null, messages: DeliveryMessage[] } };
