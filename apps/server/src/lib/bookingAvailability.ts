export type BookingInterval = {
  checkIn: Date;
  checkOut: Date;
  roomCount: number;
};

export function getPeakBookedRooms(bookings: BookingInterval[]) {
  const events = bookings.flatMap((booking) => [
    { time: booking.checkIn.getTime(), rooms: booking.roomCount },
    { time: booking.checkOut.getTime(), rooms: -booking.roomCount },
  ]);
  events.sort((left, right) => left.time - right.time || left.rooms - right.rooms);

  let occupied = 0;
  let peak = 0;
  for (const event of events) {
    occupied += event.rooms;
    peak = Math.max(peak, occupied);
  }
  return peak;
}
