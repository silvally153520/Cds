import 'dotenv/config';
import { Prisma, PrismaClient, type PropertyType, type RoomType } from '@prisma/client';

const prisma = new PrismaClient();

const propertySeeds: Array<{
  code: string;
  slug: string;
  name: string;
  type: PropertyType;
  city: string;
  district: string;
  ward: string;
  address: string;
  detailAddress: string;
  latitude: number;
  longitude: number;
  description: string;
  amenities: string[];
  image: string;
}> = [
  { code: 'SX-HN-001', slug: 'pho-co-hanoi-hotel', name: 'Phố Cổ Hà Nội Hotel', type: 'HOTEL', city: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', address: '42 Hàng Bông, Hoàn Kiếm, Hà Nội', detailAddress: 'Cách hồ Hoàn Kiếm vài phút đi bộ', latitude: 21.0295, longitude: 105.852, description: 'Khách sạn ấm cúng giữa phố cổ Hà Nội, thuận tiện khám phá hồ Hoàn Kiếm, các khu ẩm thực và di tích văn hóa của thủ đô.', amenities: ['Wi-Fi miễn phí', 'Bữa sáng', 'Lễ tân 24/7', 'Thang máy'], image: 'photo-1566073771259-6a8506099945' },
  { code: 'SX-HCM-002', slug: 'ben-thanh-green-resort', name: 'Bến Thành Green Resort', type: 'RESORT', city: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Thành', address: '18 Lê Lai, Quận 1, TP. Hồ Chí Minh', detailAddress: 'Khu vực trung tâm thành phố', latitude: 10.772, longitude: 106.698, description: 'Không gian nghỉ dưỡng xanh giữa trung tâm thành phố năng động, kết hợp tiện nghi hiện đại với dịch vụ thư giãn cho chuyến công tác và du lịch.', amenities: ['Hồ bơi', 'Spa', 'Nhà hàng', 'Wi-Fi miễn phí'], image: 'photo-1542314831-068cd1dbfeeb' },
  { code: 'SX-DN-003', slug: 'bien-xanh-da-nang-villa', name: 'Biển Xanh Đà Nẵng Villa', type: 'VILLA', city: 'Đà Nẵng', district: 'Ngũ Hành Sơn', ward: 'Mỹ An', address: '88 Võ Nguyên Giáp, Ngũ Hành Sơn, Đà Nẵng', detailAddress: 'Gần bãi biển Mỹ Khê', latitude: 16.0544, longitude: 108.2442, description: 'Biệt thự nghỉ dưỡng gần biển với không gian rộng rãi, phù hợp cho gia đình và nhóm bạn muốn tận hưởng kỳ nghỉ riêng tư tại Đà Nẵng.', amenities: ['Hồ bơi', 'Sân vườn', 'Bếp riêng', 'Bãi đỗ xe'], image: 'photo-1613490493576-7fde63acd811' },
  { code: 'SX-DL-004', slug: 'thong-may-da-lat-homestay', name: 'Thông Mây Đà Lạt Homestay', type: 'HOMESTAY', city: 'Đà Lạt', district: 'Đà Lạt', ward: 'Phường 3', address: '17 Trần Nhân Tông, Đà Lạt, Lâm Đồng', detailAddress: 'Nhà gỗ nhìn ra vườn thông', latitude: 11.9405, longitude: 108.455, description: 'Homestay nhỏ xinh giữa không khí se lạnh Đà Lạt, có khu sinh hoạt chung và góc vườn yên tĩnh cho kỳ nghỉ chậm rãi.', amenities: ['Vườn', 'Bếp dùng chung', 'Cà phê', 'Wi-Fi miễn phí'], image: 'photo-1449158743715-0a90ebb6d2d8' },
  { code: 'SX-NT-005', slug: 'vinh-ngoc-nha-trang-apartment', name: 'Vĩnh Ngọc Nha Trang Apartment', type: 'APARTMENT', city: 'Nha Trang', district: 'Vĩnh Hải', ward: 'Vĩnh Hải', address: '09 Phạm Văn Đồng, Vĩnh Hải, Nha Trang', detailAddress: 'Căn hộ hướng biển, có ban công', latitude: 12.2658, longitude: 109.2005, description: 'Căn hộ tiện nghi gần bờ biển Nha Trang, có khu bếp riêng và ban công thoáng, phù hợp cho kỳ nghỉ dài ngày.', amenities: ['Bếp riêng', 'Ban công', 'Điều hòa', 'Máy giặt'], image: 'photo-1522708323590-d24dbb6b0267' },
  { code: 'SX-PQ-006', slug: 'ngoc-dao-phu-quoc-hotel', name: 'Ngọc Đảo Phú Quốc Hotel', type: 'HOTEL', city: 'Phú Quốc', district: 'Phú Quốc', ward: 'Dương Đông', address: '12 Trần Hưng Đạo, Dương Đông, Phú Quốc', detailAddress: 'Gần chợ đêm Dương Đông', latitude: 10.2167, longitude: 103.967, description: 'Khách sạn thân thiện tại trung tâm Dương Đông, thuận tiện tham quan chợ đêm, bãi biển và các điểm vui chơi của đảo.', amenities: ['Nhà hàng', 'Đưa đón sân bay', 'Wi-Fi miễn phí', 'Lễ tân 24/7'], image: 'photo-1571896349842-33c89424de2d' },
  { code: 'SX-HL-007', slug: 'ha-long-heritage-motel', name: 'Hạ Long Heritage Motel', type: 'MOTEL', city: 'Hạ Long', district: 'Bãi Cháy', ward: 'Bãi Cháy', address: '25 Hạ Long, Bãi Cháy, Hạ Long', detailAddress: 'Cách bến tàu tham quan vịnh không xa', latitude: 20.9538, longitude: 107.041, description: 'Nhà nghỉ gọn gàng, thuận tiện cho hành trình khám phá vịnh Hạ Long, bãi biển và các khu vui chơi lân cận.', amenities: ['Wi-Fi miễn phí', 'Bãi đỗ xe', 'Điều hòa', 'Quầy lễ tân'], image: 'photo-1564013799919-ab600027ffc6' },
  { code: 'SX-HUE-008', slug: 'co-do-hue-homestay', name: 'Cố Đô Huế Homestay', type: 'HOMESTAY', city: 'Huế', district: 'Phú Xuân', ward: 'Đông Ba', address: '31 Bạch Đằng, Phú Xuân, Huế', detailAddress: 'Trong khu phố yên tĩnh bên sông', latitude: 16.4719, longitude: 107.589, description: 'Homestay mang nét duyên xứ Huế, thuận tiện ghé thăm Đại Nội, chợ Đông Ba và thưởng thức ẩm thực địa phương.', amenities: ['Bữa sáng', 'Sân trong', 'Xe đạp', 'Wi-Fi miễn phí'], image: 'photo-1445019980597-93fa8acb246c' },
  { code: 'SX-VT-009', slug: 'song-bien-vung-tau-resort', name: 'Sóng Biển Vũng Tàu Resort', type: 'RESORT', city: 'Vũng Tàu', district: 'Thành phố Vũng Tàu', ward: 'Phường 2', address: '15 Thùy Vân, Phường 2, Vũng Tàu', detailAddress: 'Đối diện bãi Sau', latitude: 10.3331, longitude: 107.087, description: 'Khu nghỉ dưỡng ven biển với hồ bơi và nhà hàng, là điểm dừng chân phù hợp cho kỳ nghỉ cuối tuần tại Vũng Tàu.', amenities: ['Hồ bơi', 'Nhà hàng', 'Bãi đỗ xe', 'Phòng gia đình'], image: 'photo-1507525428034-b723cf961d3e' },
  { code: 'SX-SP-010', slug: 'may-nui-sa-pa-villa', name: 'Mây Núi Sa Pa Villa', type: 'VILLA', city: 'Sa Pa', district: 'Sa Pa', ward: 'Sa Pa', address: '08 Fansipan, Sa Pa, Lào Cai', detailAddress: 'Tầm nhìn hướng thung lũng', latitude: 22.3364, longitude: 103.8438, description: 'Biệt thự nghỉ dưỡng giữa núi rừng Sa Pa với không gian ấm áp, thích hợp ngắm cảnh và khám phá bản làng vùng cao.', amenities: ['Lò sưởi', 'Nhà hàng', 'Sân hiên', 'Wi-Fi miễn phí'], image: 'photo-1510798831971-661eb04b3739' },
];

const roomTypes: RoomType[] = ['STANDARD', 'DELUXE', 'VIP', 'FAMILY', 'DELUXE'];
const roomNames = ['Phòng Tiêu Chuẩn', 'Phòng Deluxe', 'Phòng VIP', 'Phòng Gia Đình', 'Phòng Ban Công'];
const roomImages = [
  'photo-1505693416388-ac5ce068fe85',
  'photo-1494526585095-c41746248156',
  'photo-1502672260266-1c1ef2d93688',
  'photo-1522708323590-d24dbb6b0267',
  'photo-1484154218962-a197022b5858',
];
const roomPrices = [500_000, 700_000, 1_100_000, 1_500_000, 1_800_000];

const imageUrl = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

async function main() {
  const host = await prisma.user.findFirst({
    where: { role: 'HOST', hostApplication: { is: { status: 'APPROVED' } } },
    select: { id: true },
  }) ?? await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  }) ?? await prisma.user.findFirst({
    where: { role: 'HOST' },
    select: { id: true },
  });

  if (!host) {
    throw new Error('Seed requires an existing ADMIN or HOST account. No user was created.');
  }

  const propertyIds = new Map<string, string>();
  const roomCodes: string[] = [];

  for (const [propertyIndex, item] of propertySeeds.entries()) {
    const { image, ...propertyData } = item;
    const property = await prisma.property.upsert({
      where: { slug: propertyData.slug },
      update: {
        code: propertyData.code,
        name: propertyData.name,
        type: propertyData.type,
        description: propertyData.description,
        address: propertyData.address,
        detailAddress: propertyData.detailAddress,
        city: propertyData.city,
        district: propertyData.district,
        ward: propertyData.ward,
        latitude: propertyData.latitude,
        longitude: propertyData.longitude,
        amenities: propertyData.amenities,
        images: [imageUrl(image)],
        policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Không hút thuốc trong phòng'],
        status: 'ACTIVE',
        rejectionReason: null,
      },
      create: {
        ...propertyData,
        images: [imageUrl(image)],
        policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Không hút thuốc trong phòng'],
        status: 'ACTIVE',
        hostId: host.id,
      },
    });
    propertyIds.set(item.slug, property.id);

    const roomOperations = roomTypes.map((type, roomIndex) => {
      const code = `${item.code}-R${String(roomIndex + 1).padStart(2, '0')}`;
      const basePrice = roomPrices[roomIndex] + propertyIndex * 20_000;
      const roomData = {
        name: `${roomNames[roomIndex]} ${item.city}`,
        type,
        description: `${roomNames[roomIndex]} tại ${item.name}, được trang bị tiện nghi cần thiết để mang lại kỳ nghỉ thoải mái tại ${item.city}.`,
        basePrice: new Prisma.Decimal(basePrice),
        weekendPrice: new Prisma.Decimal(Math.round(basePrice * 1.2)),
        holidayPrice: new Prisma.Decimal(Math.round(basePrice * 1.5)),
        maxGuests: [2, 3, 2, 4, 2][roomIndex],
        maxAdults: [2, 2, 2, 2, 2][roomIndex],
        maxChildren: [0, 1, 0, 2, 0][roomIndex],
        area: [22, 30, 38, 45, 28][roomIndex],
        bedCount: roomIndex === 3 ? 2 : 1,
        bedType: roomIndex === 3 ? '2 giường đôi' : '1 giường đôi',
        availableRooms: 3,
        images: [imageUrl(roomImages[roomIndex])],
        amenities: ['Wi-Fi', 'Điều hòa', roomIndex === 3 ? 'Phòng gia đình' : 'Giường đôi'],
        status: 'ACTIVE',
      };
      roomCodes.push(code);
      return prisma.room.upsert({
        where: { code },
        update: { ...roomData, propertyId: property.id },
        create: { code, ...roomData, propertyId: property.id },
      });
    });
    await prisma.$transaction(roomOperations);
  }

  const totalProperties = await prisma.property.count();
  const totalRooms = await prisma.room.count();
  const samplePropertyCount = await prisma.property.count({ where: { slug: { in: propertySeeds.map((item) => item.slug) } } });
  const sampleRoomCount = await prisma.room.count({ where: { code: { in: roomCodes } } });
  if (propertyIds.size !== 10 || roomCodes.length !== 50 || samplePropertyCount !== 10 || sampleRoomCount !== 50) {
    throw new Error(`Seed verification failed: ${samplePropertyCount}/10 properties and ${sampleRoomCount}/50 rooms found.`);
  }

  console.log('Sample property seed completed.', {
    sampleProperties: samplePropertyCount,
    sampleRooms: sampleRoomCount,
    totalProperties,
    totalRooms,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
