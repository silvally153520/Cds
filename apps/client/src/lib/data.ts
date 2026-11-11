export type RoomCard = {
  id: string;
  name: string;
  location: string;
  type: 'Hotel' | 'Resort' | 'Villa';
  price: number;
  guests: number;
  rating: number;
  image: string;
  host: string;
  badge: string;
};

export const featureRooms: RoomCard[] = [];

export const stats: Array<{ label: string; value: string }> = [];

export const categoryCards: Array<{ title: string; description: string; icon: string }> = [];

export const destinations: Array<{ city: string; count: string; image: string }> = [];
