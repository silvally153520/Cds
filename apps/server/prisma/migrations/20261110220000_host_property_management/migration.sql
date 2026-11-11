ALTER TABLE "Property"
  ADD COLUMN "code" VARCHAR(80),
  ADD COLUMN "detailAddress" VARCHAR(255),
  ADD COLUMN "ward" VARCHAR(120),
  ADD COLUMN "rejectionReason" TEXT;

CREATE UNIQUE INDEX "Property_code_key" ON "Property"("code");

ALTER TABLE "Room"
  ADD COLUMN "maxAdults" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "maxChildren" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "area" DOUBLE PRECISION,
  ADD COLUMN "bedCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "bedType" VARCHAR(80),
  ADD COLUMN "weekendPrice" DECIMAL(12,2),
  ADD COLUMN "holidayPrice" DECIMAL(12,2);

CREATE TABLE "RoomAvailability" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "RoomAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomAvailability_roomId_date_key" ON "RoomAvailability"("roomId", "date");
CREATE INDEX "RoomAvailability_date_status_idx" ON "RoomAvailability"("date", "status");
ALTER TABLE "RoomAvailability"
  ADD CONSTRAINT "RoomAvailability_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RoomPrice" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "kind" VARCHAR(20) NOT NULL DEFAULT 'CUSTOM',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "RoomPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomPrice_roomId_date_key" ON "RoomPrice"("roomId", "date");
ALTER TABLE "RoomPrice"
  ADD CONSTRAINT "RoomPrice_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
