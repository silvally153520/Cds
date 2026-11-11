import { Prisma, PrismaClient, type BookingStatus, type PaymentStatus, type PropertyType, type RoomType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type PropertySeedItem = {
  slug: string;
  name: string;
  type: PropertyType;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  amenities: string[];
  images: string[];
  policies: string[];
  rooms: Array<{
    code: string;
    name: string;
    type: RoomType;
    price: string;
    maxGuests: number;
    images: string[];
    amenities: string[];
  }>;
  hostEmail: string;
};

const propertySeed: PropertySeedItem[] = [
  {
    slug: 'emerald-river-hotel',
    name: 'Emerald River Hotel',
    type: 'HOTEL',
    city: 'Hà Nội',
    district: 'Hoàn Kiếm',
    address: '42 Hàng Bông, Phường Hàng Trống, Quận Hoàn Kiếm, Hà Nội',
    latitude: 21.0295,
    longitude: 105.852,
    description:
      'Khách sạn boutique ngay trung tâm Hà Nội, phục vụ khách du lịch và doanh nhân với không gian hiện đại, bữa sáng sáng tạo và vị trí thuận tiện cho các điểm tham quan nổi tiếng.',
    amenities: ['Wi‑Fi miễn phí', 'Bữa sáng', 'Bãi đỗ xe', 'Phòng gym', 'Dịch vụ giặt ủi', 'Lễ tân 24/7'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Hủy miễn phí trước 48 giờ'],
    rooms: [
      { code: 'ERH-STD-101', name: 'Standard City View', type: 'STANDARD', price: '650000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Giường đôi', 'View thành phố', 'Tủ lạnh', 'Máy lạnh'] },
      { code: 'ERH-DEL-201', name: 'Deluxe Riverside', type: 'DELUXE', price: '980000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Bồn tắm', 'TV 4K', 'Lò sưởi'] },
      { code: 'ERH-VIP-301', name: 'Executive Suite', type: 'VIP', price: '1650000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng khách riêng', 'Bữa sáng riêng', 'Dịch vụ phòng', 'View hồ'] },
    ],
    hostEmail: 'host.hanoi1@sieuechxanh.com',
  },
  {
    slug: 'phoenix-bay-resort',
    name: 'Phoenix Bay Resort',
    type: 'RESORT',
    city: 'Đà Nẵng',
    district: 'Ngũ Hành Sơn',
    address: '88 Bãi biển Mỹ Khê, Phường Khuê Mỹ, Quận Ngũ Hành Sơn, Đà Nẵng',
    latitude: 16.0682,
    longitude: 108.231,
    description:
      'Resort ven biển với thiết kế hiện đại, hồ bơi vô cực, khu spa và ghế nằm thoải mái để bạn tận hưởng kỳ nghỉ dài ngày bên bờ biển.',
    amenities: ['Hồ bơi', 'Spa', 'Wi‑Fi miễn phí', 'Nhà hàng', 'Đạp xe', 'Cho thuê xe máy'],
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 15:00', 'Trả phòng trước 11:00', 'Tour biển miễn phí'],
    rooms: [
      { code: 'PBR-STD-102', name: 'Garden Room', type: 'STANDARD', price: '740000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'], amenities: ['View vườn', 'Giường king', 'Máy lạnh', 'Tủ quần áo'] },
      { code: 'PBR-DEL-202', name: 'Ocean Deluxe', type: 'DELUXE', price: '1150000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['View biển', 'Ban công', 'Bồn tắm', 'Máy sấy'] },
      { code: 'PBR-VIP-302', name: 'Beachfront Villa Suite', type: 'VIP', price: '1950000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng tắm ngoài trời', 'Hồ bơi cá nhân', 'Dịch vụ phòng', 'View biển'] },
    ],
    hostEmail: 'host.danang1@sieuechxanh.com',
  },
  {
    slug: 'saffron-garden-villa',
    name: 'Saffron Garden Villa',
    type: 'VILLA',
    city: 'Nha Trang',
    district: 'Vĩnh Hải',
    address: '09 Cầu Đá, Phường Vĩnh Hai, Nha Trang, Khánh Hòa',
    latitude: 12.2483,
    longitude: 109.1999,
    description:
      'Biệt thự xanh mát giữa thiên nhiên với vườn cây nhiệt đới, hồ bơi riêng và khu vực BBQ, lý tưởng cho kỳ nghỉ gia đình.',
    amenities: ['Hồ bơi riêng', 'BBQ', 'Sân vườn', 'Máy giặt', 'Phòng ăn', 'Xe đưa đón'],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Có thể tổ chức BBQ'],
    rooms: [
      { code: 'SGV-STD-103', name: 'Family Room', type: 'STANDARD', price: '690000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Giường ngủ gia đình', 'Máy lạnh', 'Tủ quần áo', 'Ban công'] },
      { code: 'SGV-DEL-203', name: 'Garden Deluxe', type: 'DELUXE', price: '1040000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['View vườn', 'Bồn tắm', 'TV 4K', 'Tủ đồ'] },
      { code: 'SGV-VIP-303', name: 'Private Pool Villa', type: 'VIP', price: '2200000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Hồ bơi riêng', 'Phòng khách', 'Sân ngoài trời', 'Dịch vụ làm bếp'] },
    ],
    hostEmail: 'host.nhatrang1@sieuechxanh.com',
  },
  {
    slug: 'green-peak-homestay',
    name: 'Green Peak Homestay',
    type: 'HOMESTAY',
    city: 'Đà Lạt',
    district: 'Phường 1',
    address: '17 Đường Trần Nhân Tông, Phường 1, TP. Đà Lạt, Lâm Đồng',
    latitude: 11.9405,
    longitude: 108.455,
    description:
      'Homestay được thiết kế theo phong cách châu Âu, nằm gần trung tâm Đà Lạt, thích hợp cho du khách muốn tận hưởng không khí yên bình, cà phê và cảnh quan mát lạnh.',
    amenities: ['Sân ngoài trời', 'Khu vực làm việc', 'Wi‑Fi', 'Nhà bếp', 'Cà phê miễn phí', 'Tủ quần áo'],
    images: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 13:00', 'Trả phòng trước 11:30', 'Mở cửa 24/7'],
    rooms: [
      { code: 'GPH-STD-104', name: 'Cozy Room', type: 'STANDARD', price: '520000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Giường đơn', 'Máy lạnh', 'Ban công', 'Tủ lạnh'] },
      { code: 'GPH-DEL-204', name: 'Balcony Deluxe', type: 'DELUXE', price: '860000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công view núi', 'Máy sấy', 'Bồn tắm', 'Tivi'] },
      { code: 'GPH-FAM-304', name: 'Family Loft', type: 'FAMILY', price: '1190000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng khách riêng', '2 giường', 'Nhà bếp mini', 'Ban công'] },
    ],
    hostEmail: 'host.dalat1@sieuechxanh.com',
  },
  {
    slug: 'harbor-queen-hotel',
    name: 'Harbor Queen Hotel',
    type: 'HOTEL',
    city: 'Hải Phòng',
    district: 'Hồng Bàng',
    address: '24 Nguyễn Bỉnh Khiêm, Phường Đằng Giang, Quận Hồng Bàng, Hải Phòng',
    latitude: 20.8575,
    longitude: 106.682,
    description:
      'Khách sạn 4 sao gần cảng và trung tâm thành phố, đáp ứng nhu cầu nghỉ ngắn ngày, công tác và du lịch gia đình.',
    amenities: ['Wi‑Fi miễn phí', 'Thang máy', 'Lễ tân 24/7', 'Dịch vụ taxi', 'Phòng họp'],
    images: [
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Có thể thanh toán online'],
    rooms: [
      { code: 'HQH-STD-105', name: 'Comfort Twin', type: 'STANDARD', price: '580000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'], amenities: ['Giường twin', 'Máy lạnh', 'Sofa', 'Tủ lạnh'] },
      { code: 'HQH-DEL-205', name: 'Harbor Deluxe', type: 'DELUXE', price: '920000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['View cảng', 'Ban công', 'Bồn tắm', 'Tivi'] },
      { code: 'HQH-VIP-305', name: 'Sky Suite', type: 'VIP', price: '1700000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng làm việc', 'View quận', 'Dịch vụ phòng', 'Giường king'] },
    ],
    hostEmail: 'host.haiphong1@sieuechxanh.com',
  },
  {
    slug: 'golden-lake-resort',
    name: 'Golden Lake Resort',
    type: 'RESORT',
    city: 'Hòa Bình',
    district: 'Mai Châu',
    address: '17 Thôn Chàng, Xã Mai Châu, Huyện Mai Châu, Hòa Bình',
    latitude: 20.6803,
    longitude: 105.081,
    description:
      'Resort nằm bên hồ nước trong xanh, mang không khí yên bình của núi rừng với các bungalow và khu vui chơi ngoài trời cho cả gia đình.',
    amenities: ['Hồ bơi', 'Vườn cây', 'Sân chơi', 'Dịch vụ xe đạp', 'Quầy lễ tân', 'Nhà hàng'],
    images: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Tặng tour chèo thuyền'],
    rooms: [
      { code: 'GLR-STD-106', name: 'Bungalow Standard', type: 'STANDARD', price: '620000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Bungalow', 'Máy lạnh', 'Giường đôi', 'View hồ'] },
      { code: 'GLR-DEL-206', name: 'Bungalow Deluxe', type: 'DELUXE', price: '980000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Hồ nước', 'Bồn tắm', 'Máy sấy'] },
      { code: 'GLR-VIP-306', name: 'Family Lake Villa', type: 'VIP', price: '1820000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Hồ bơi riêng', 'Phòng ăn riêng', 'Sân ngoài trời', 'Gác lửng'] },
    ],
    hostEmail: 'host.hoabinh1@sieuechxanh.com',
  },
  {
    slug: 'bamboo-breeze-villa',
    name: 'Bamboo Breeze Villa',
    type: 'VILLA',
    city: 'Phú Quốc',
    district: 'Dương Tơ',
    address: '38 Phú Quý, Xã Dương Tơ, Huyện Phú Quốc, Kiên Giang',
    latitude: 10.2086,
    longitude: 103.962,
    description:
      'Villa nghỉ dưỡng với tầm nhìn ra biển và nội thất gỗ tự nhiên, tạo không gian thư giãn tuyệt vời cho những kỳ nghỉ dài ngày.',
    amenities: ['Hồ bơi riêng', 'View biển', 'BBQ', 'Xe đạp', 'Dịch vụ cho thuê xe', 'Gác mái'],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 15:00', 'Trả phòng trước 12:00', 'Cho thuê xe máy'],
    rooms: [
      { code: 'BBV-STD-107', name: 'Sea Standard', type: 'STANDARD', price: '710000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'], amenities: ['View biển', 'Máy lạnh', 'Giường lớn', 'Ban công'] },
      { code: 'BBV-DEL-207', name: 'Ocean Deluxe', type: 'DELUXE', price: '1200000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công rộng', 'Bồn tắm', 'Phòng tắm ngoài trời', 'Tủ đồ'] },
      { code: 'BBV-VIP-307', name: 'Private Beach Villa', type: 'VIP', price: '2450000', maxGuests: 6, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Hồ bơi riêng', 'Phòng khách', 'BBQ', 'View biển panoramic'] },
    ],
    hostEmail: 'host.phuquoc1@sieuechxanh.com',
  },
  {
    slug: 'sunset-cove-homestay',
    name: 'Sunset Cove Homestay',
    type: 'HOMESTAY',
    city: 'Nha Trang',
    district: 'Vĩnh Thọ',
    address: '55 Đường Trần Phú, Phường Vĩnh Thọ, Nha Trang, Khánh Hòa',
    latitude: 12.2424,
    longitude: 109.196,
    description:
      'Homestay nằm gần bãi biển, có thiết kế tối giản, không gian thoáng mát và phù hợp cho nhóm bạn hoặc gia đình nhỏ.',
    amenities: ['Wi‑Fi', 'Quán cà phê', 'Sân thượng', 'Bữa sáng', 'Bãi biển gần đó', 'Phòng tắm'],
    images: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Phù hợp nhóm bạn'],
    rooms: [
      { code: 'SCH-STD-108', name: 'Beach Standard', type: 'STANDARD', price: '560000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['View biển', 'Máy lạnh', 'Tủ lạnh', 'Giường king'] },
      { code: 'SCH-DEL-208', name: 'Corner Deluxe', type: 'DELUXE', price: '870000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Bồn tắm', 'Sân thượng', 'Tivi', 'Bữa sáng'] },
      { code: 'SCH-FAM-308', name: 'Family Loft', type: 'FAMILY', price: '1360000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'], amenities: ['2 giường', 'Phòng ngoài trời', 'Nhà bếp mini', 'Điều hòa'] },
    ],
    hostEmail: 'host.nhatrang2@sieuechxanh.com',
  },
  {
    slug: 'nile-park-hotel',
    name: 'Nile Park Hotel',
    type: 'HOTEL',
    city: 'Huế',
    district: 'Phú Hậu',
    address: '12 Lê Lợi, Phường Vĩnh Ninh, TP. Huế, Thừa Thiên Huế',
    latitude: 16.4667,
    longitude: 107.5909,
    description:
      'Khách sạn gần trung tâm thành phố Huế phù hợp cho khách du lịch khám phá di sản văn hóa với không gian lịch sự và dịch vụ tận tâm.',
    amenities: ['Wi‑Fi', 'Lễ tân', 'Bữa sáng', 'Bãi giữ xe', 'Dịch vụ đưa đón', 'Phòng họp'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Có thể đặt sớm'],
    rooms: [
      { code: 'NPH-STD-109', name: 'City Comfort', type: 'STANDARD', price: '610000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Máy lạnh', 'Giường đơn', 'Tủ lạnh', 'Bồn tắm'] },
      { code: 'NPH-DEL-209', name: 'Heritage Deluxe', type: 'DELUXE', price: '940000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['View thành phố', 'Ban công', 'TV', 'Máy sấy'] },
      { code: 'NPH-VIP-309', name: 'Royal Suite', type: 'VIP', price: '1750000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng khách', 'Bữa sáng riêng', 'Dịch vụ phòng'] },
    ],
    hostEmail: 'host.hue1@sieuechxanh.com',
  },
  {
    slug: 'misty-mountain-resort',
    name: 'Misty Mountain Resort',
    type: 'RESORT',
    city: 'Sa Pa',
    district: 'Bắc Quang',
    address: '27 Đường Mường Hoa, Phường Sa Pa, Lào Cai',
    latitude: 22.3367,
    longitude: 103.843,
    description:
      'Resort trên cao nguyên Sa Pa với không khí mát mẻ, cầu vồng sương mù và cảnh quan ngắm núi, rất thích hợp cho những chuyến nghỉ dưỡng thư giãn.',
    amenities: ['Hồ bơi', 'View núi', 'Wi‑Fi', 'Nhà hàng', 'Dịch vụ tour', 'Trà chủ nhà'],
    images: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 11:00', 'Cho thuê áo khoác'],
    rooms: [
      { code: 'MMR-STD-110', name: 'Valley Standard', type: 'STANDARD', price: '630000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['View thung lũng', 'Máy lạnh', 'Giường đôi', 'Tủ quần áo'] },
      { code: 'MMR-DEL-210', name: 'Cloud Deluxe', type: 'DELUXE', price: '1010000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Bồn tắm', 'Tivi 4K', 'View núi'] },
      { code: 'MMR-VIP-310', name: 'Mountain View Suite', type: 'VIP', price: '1880000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng khách riêng', 'Bữa ăn sáng', 'Dịch vụ phòng', 'Sân ngoài trời'] },
    ],
    hostEmail: 'host.sapa1@sieuechxanh.com',
  },
  {
    slug: 'lotus-river-villa',
    name: 'Lotus River Villa',
    type: 'VILLA',
    city: 'Cần Thơ',
    district: 'Ninh Kiều',
    address: '48 Đường Nguyễn Văn Linh, Phường Cái Khế, Quận Ninh Kiều, Cần Thơ',
    latitude: 10.0374,
    longitude: 105.786,
    description:
      'Villa ven sông với không gian mở, rất phù hợp cho các gia đình muốn nghỉ dưỡng một cách yên bình và tận hưởng thiên nhiên vùng đồng bằng.',
    amenities: ['View sông', 'Hồ bơi nhỏ', 'BBQ', 'Nhà bếp', 'Gác lửng', 'Xe đạp'],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Chuyến đi 2 đêm trở lên được ưu đãi'],
    rooms: [
      { code: 'LRV-STD-111', name: 'Garden Room', type: 'STANDARD', price: '590000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'], amenities: ['View vườn', 'Máy lạnh', 'Giường đôi', 'Tủ khăn'] },
      { code: 'LRV-DEL-211', name: 'River Deluxe', type: 'DELUXE', price: '910000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['View sông', 'Bồn tắm', 'Ban công', 'Sofa'] },
      { code: 'LRV-VIP-311', name: 'Family Villa Suite', type: 'VIP', price: '1680000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng khách', 'Bếp riêng', 'Hồ bơi nhỏ', 'BBQ'] },
    ],
    hostEmail: 'host.cantho1@sieuechxanh.com',
  },
  {
    slug: 'pink-petal-homestay',
    name: 'Pink Petal Homestay',
    type: 'HOMESTAY',
    city: 'Hội An',
    district: 'Minh An',
    address: '88 Trần Phú, Phường Minh An, Hội An, Quảng Nam',
    latitude: 15.8794,
    longitude: 108.333,
    description:
      'Homestay hơn 120 năm tuổi được cải tạo thành nơi lưu trú xinh đẹp, gần phố cổ Hội An, rất lý tưởng cho du khách thích trải nghiệm văn hóa địa phương.',
    amenities: ['Wi‑Fi', 'Bữa sáng', 'Bicycle', 'Phòng khoe nét cổ', 'Tủ đồ', 'Nhà bếp'],
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 13:30', 'Trả phòng trước 12:00', 'Phù hợp khám phá phố cổ'],
    rooms: [
      { code: 'PPH-STD-112', name: 'Classic Room', type: 'STANDARD', price: '540000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Giường gỗ', 'Máy lạnh', 'Sofa', 'Tủ để đồ'] },
      { code: 'PPH-DEL-212', name: 'Heritage Deluxe', type: 'DELUXE', price: '830000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Bồn tắm', 'View phố cổ', 'Máy sấy'] },
      { code: 'PPH-FAM-312', name: 'Family Courtyard', type: 'FAMILY', price: '1260000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'], amenities: ['Sân trong', '2 giường', 'Nhà bếp mini', 'Máy lạnh'] },
    ],
    hostEmail: 'host.hoan1@sieuechxanh.com',
  },
  {
    slug: 'amber-sky-hotel',
    name: 'Amber Sky Hotel',
    type: 'HOTEL',
    city: 'Vinh',
    district: 'Nghi Xuân',
    address: '18 Trưng Trắc, Phường Hưng Bình, Thị xã Vinh, Nghệ An',
    latitude: 18.6796,
    longitude: 105.6819,
    description:
      'Khách sạn hiện đại gần trung tâm thành phố Vinh, thích hợp cho khách doanh nhân và những chuyến công tác ngắn ngày.',
    amenities: ['Wi‑Fi', 'Bữa sáng', 'Phòng họp', 'Lễ tân', 'Vận chuyển sân bay', 'Phòng gym'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Dịch vụ doanh nhân'],
    rooms: [
      { code: 'ASH-STD-113', name: 'Business Standard', type: 'STANDARD', price: '600000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'], amenities: ['Bàn làm việc', 'Máy lạnh', 'Tủ lạnh', 'Giường đôi'] },
      { code: 'ASH-DEL-213', name: 'Executive Deluxe', type: 'DELUXE', price: '950000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Bồn tắm', 'View thành phố', 'TV 4K'] },
      { code: 'ASH-VIP-313', name: 'Sky Executive', type: 'VIP', price: '1720000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng làm việc', 'Dịch vụ phòng', 'Giường king', 'Bữa sáng riêng'] },
    ],
    hostEmail: 'host.vinh1@sieuechxanh.com',
  },
  {
    slug: 'coconut-bay-resort',
    name: 'Coconut Bay Resort',
    type: 'RESORT',
    city: 'Bà Rịa - Vũng Tàu',
    district: 'Long Hải',
    address: '14 Bãi Sau, Phường Long Hải, Bà Rịa - Vũng Tàu',
    latitude: 10.3857,
    longitude: 107.168,
    description:
      'Resort gần biển với bãi tắm riêng, khu nhà hàng và dịch vụ spa, đáp ứng nhu cầu nghỉ dưỡng dài ngày cho cả gia đình và nhóm bạn.',
    amenities: ['Bãi biển riêng', 'Spa', 'Hồ bơi', 'Nhà hàng', 'Wifi', 'Cho thuê dù'],
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 15:00', 'Trả phòng trước 12:00', 'Tặng suất spa cho 2 đêm'],
    rooms: [
      { code: 'CBR-STD-114', name: 'Coconut Standard', type: 'STANDARD', price: '680000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'], amenities: ['View biển', 'Máy lạnh', 'Giường king', 'Tủ lạnh'] },
      { code: 'CBR-DEL-214', name: 'Sunset Deluxe', type: 'DELUXE', price: '1090000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Bồn tắm', 'Hồ bơi chung', 'TV'] },
      { code: 'CBR-VIP-314', name: 'Beachfront Suite', type: 'VIP', price: '2100000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['View trực diện biển', 'Phòng khách', 'Spa miễn phí', 'Dịch vụ phòng'] },
    ],
    hostEmail: 'host.vungtau1@sieuechxanh.com',
  },
  {
    slug: 'cloud-sail-villa',
    name: 'Cloud Sail Villa',
    type: 'VILLA',
    city: 'Mũi Né',
    district: 'Phú Hài',
    address: '22 Đường Dương Đình Nghệ, Phường Mũi Né, Bình Thuận',
    latitude: 10.9489,
    longitude: 108.257,
    description:
      'Biệt thự nghỉ dưỡng theo phong cách hiện đại, kèm hồ bơi và ban công rộng, rất thích hợp cho chuyến du lịch biển dài ngày.',
    amenities: ['Hồ bơi', 'Sân ngoài trời', 'BBQ', 'Máy giặt', 'Wifi', 'Dịch vụ đưa đón'],
    images: [
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 14:00', 'Trả phòng trước 12:00', 'Cho thuê dù biển'],
    rooms: [
      { code: 'CSV-STD-115', name: 'Sun Room', type: 'STANDARD', price: '640000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'], amenities: ['Máy lạnh', 'Giường đôi', 'Tủ quần áo', 'Ban công'] },
      { code: 'CSV-DEL-215', name: 'Sea View Deluxe', type: 'DELUXE', price: '1120000', maxGuests: 4, images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'], amenities: ['View biển', 'Bồn tắm', 'Sofa', 'Máy sấy'] },
      { code: 'CSV-VIP-315', name: 'Private Pool Villa', type: 'VIP', price: '2300000', maxGuests: 6, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['Hồ bơi riêng', 'Phòng khách', 'Sân ngoài trời', 'BBQ'] },
    ],
    hostEmail: 'host.muine1@sieuechxanh.com',
  },
  {
    slug: 'cajuput-haven-homestay',
    name: 'Cajuput Haven Homestay',
    type: 'HOMESTAY',
    city: 'Bắc Giang',
    district: 'Lạng Giang',
    address: '66 Thôn Cúc, Xã Lạng Giang, Tỉnh Bắc Giang',
    latitude: 21.2564,
    longitude: 106.186,
    description:
      'Homestay yên tĩnh giữa vườn bạch đàn, thích hợp cho những chuyến nghỉ dưỡng cuối tuần với không gian thư giãn và các hoạt động ngoài trời.',
    amenities: ['Vườn', 'Hiên', 'Wi‑Fi', 'Nhà bếp', 'BBQ', 'Chiếu ngoài trời'],
    images: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    ],
    policies: ['Nhận phòng từ 13:00', 'Trả phòng trước 12:00', 'Rất phù hợp cuối tuần'],
    rooms: [
      { code: 'CHH-STD-116', name: 'Garden Standard', type: 'STANDARD', price: '490000', maxGuests: 2, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'], amenities: ['View vườn', 'Máy lạnh', 'Giường gỗ', 'Tủ quần áo'] },
      { code: 'CHH-DEL-216', name: 'Forest Deluxe', type: 'DELUXE', price: '820000', maxGuests: 3, images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'], amenities: ['Ban công', 'Bồn tắm', 'Sân ngoài trời', 'Tivi'] },
      { code: 'CHH-FAM-316', name: 'Family Courtyard', type: 'FAMILY', price: '1280000', maxGuests: 5, images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'], amenities: ['Phòng ăn', '2 giường', 'Phòng ngoài trời', 'Nhà bếp'] },
    ],
    hostEmail: 'host.bacgiang1@sieuechxanh.com',
  },
];

const hostAccounts = [
  'host.hanoi1@sieuechxanh.com',
  'host.danang1@sieuechxanh.com',
  'host.nhatrang1@sieuechxanh.com',
  'host.dalat1@sieuechxanh.com',
  'host.haiphong1@sieuechxanh.com',
  'host.hoabinh1@sieuechxanh.com',
  'host.phuquoc1@sieuechxanh.com',
  'host.nhatrang2@sieuechxanh.com',
  'host.hue1@sieuechxanh.com',
  'host.sapa1@sieuechxanh.com',
  'host.cantho1@sieuechxanh.com',
  'host.hoan1@sieuechxanh.com',
  'host.vinh1@sieuechxanh.com',
  'host.vungtau1@sieuechxanh.com',
  'host.muine1@sieuechxanh.com',
  'host.bacgiang1@sieuechxanh.com',
];

const sampleCustomers = [
  { email: 'customer.an@sieuechxanh.com', fullName: 'Trần Văn An', phone: '+84 912 010 101' },
  { email: 'customer.binh@sieuechxanh.com', fullName: 'Nguyễn Minh Bình', phone: '+84 913 020 202' },
  { email: 'customer.chi@sieuechxanh.com', fullName: 'Lê Thị Chi', phone: '+84 914 030 303' },
  { email: 'customer.dung@sieuechxanh.com', fullName: 'Phạm Đình Dũng', phone: '+84 915 040 404' },
  { email: 'customer.emmy@sieuechxanh.com', fullName: 'Hoàng Thị Em', phone: '+84 916 050 505' },
];

const bookingSamples: Array<{
  code: string;
  userEmail: string;
  roomCode: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  roomCount: number;
  serviceFee: string;
  totalPrice: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
}> = [
  { code: 'BK-1001', userEmail: 'customer.an@sieuechxanh.com', roomCode: 'ERH-DEL-201', checkIn: '2026-11-12', checkOut: '2026-11-15', guestCount: 2, roomCount: 1, serviceFee: '150000', totalPrice: '3240000', status: 'CONFIRMED', paymentStatus: 'PAID' },
  { code: 'BK-1002', userEmail: 'customer.binh@sieuechxanh.com', roomCode: 'PBR-DEL-202', checkIn: '2026-12-02', checkOut: '2026-12-05', guestCount: 3, roomCount: 1, serviceFee: '200000', totalPrice: '3650000', status: 'CONFIRMED', paymentStatus: 'PENDING' },
  { code: 'BK-1003', userEmail: 'customer.chi@sieuechxanh.com', roomCode: 'SGV-VIP-303', checkIn: '2026-12-10', checkOut: '2026-12-14', guestCount: 4, roomCount: 1, serviceFee: '250000', totalPrice: '9150000', status: 'CONFIRMED', paymentStatus: 'PAID' },
  { code: 'BK-1004', userEmail: 'customer.dung@sieuechxanh.com', roomCode: 'GPH-FAM-304', checkIn: '2026-11-20', checkOut: '2026-11-22', guestCount: 4, roomCount: 1, serviceFee: '180000', totalPrice: '2500000', status: 'CANCELLED', paymentStatus: 'REFUNDED' },
  { code: 'BK-1005', userEmail: 'customer.emmy@sieuechxanh.com', roomCode: 'MMR-VIP-310', checkIn: '2026-12-20', checkOut: '2026-12-24', guestCount: 3, roomCount: 1, serviceFee: '300000', totalPrice: '7920000', status: 'CONFIRMED', paymentStatus: 'PAID' },
];

async function main() {
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const userPassword = await bcrypt.hash('User@123', 10);
  const hostPassword = await bcrypt.hash('Host@123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@sieuechxanh.com' },
    update: {},
    create: {
      email: 'admin@sieuechxanh.com',
      password: adminPassword,
      fullName: 'System Administrator',
      phone: '+84 912 345 678',
      role: 'ADMIN',
    },
  });

  for (const email of hostAccounts) {
    const host = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hostPassword,
        fullName: email.split('@')[0].replace(/\./g, ' ').replace(/(^\w|\s\w)/g, (match) => match.toUpperCase()),
        phone: '+84 900 000 000',
        role: 'HOST',
      },
    });

    await prisma.hostApplication.upsert({
      where: { userId: host.id },
      update: { status: 'APPROVED', rejectionReason: null },
      create: {
        userId: host.id,
        fullName: host.fullName,
        phone: host.phone ?? '+84 900 000 000',
        address: 'Vietnam',
        reason: 'Kinh doanh lưu trú dài hạn trên Sieuechxanh.',
        status: 'APPROVED',
      },
    });
  }

  for (const person of sampleCustomers) {
    await prisma.user.upsert({
      where: { email: person.email },
      update: {},
      create: {
        email: person.email,
        password: userPassword,
        fullName: person.fullName,
        phone: person.phone,
        role: 'USER',
      },
    });
  }

  for (const item of propertySeed) {
    const host = await prisma.user.findUnique({ where: { email: item.hostEmail } });
    if (!host) continue;

    const property = await prisma.property.upsert({
      where: { slug: item.slug },
      update: {
        status: 'ACTIVE',
      },
      create: {
        name: item.name,
        slug: item.slug,
        type: item.type,
        description: item.description,
        address: item.address,
        city: item.city,
        district: item.district,
        latitude: item.latitude,
        longitude: item.longitude,
        amenities: item.amenities,
        images: item.images,
        policies: item.policies,
        status: 'ACTIVE',
        hostId: host.id,
      },
    });

    for (const roomSeed of item.rooms) {
      await prisma.room.upsert({
        where: { code: roomSeed.code },
        update: { status: 'ACTIVE' },
        create: {
          code: roomSeed.code,
          name: roomSeed.name,
          type: roomSeed.type,
          description: `Phòng ${roomSeed.name} tại ${item.name}, được thiết kế dành cho ${roomSeed.maxGuests} khách với nội thất sang trọng và tiện nghi đầy đủ.`,
          basePrice: new Prisma.Decimal(roomSeed.price),
          maxGuests: roomSeed.maxGuests,
          availableRooms: 3,
          images: roomSeed.images,
          amenities: roomSeed.amenities,
          propertyId: property.id,
          status: 'ACTIVE',
        },
      });
    }
  }

  for (const booking of bookingSamples) {
    const user = await prisma.user.findUnique({ where: { email: booking.userEmail } });
    const room = await prisma.room.findUnique({ where: { code: booking.roomCode } });

    if (!user || !room) continue;

    await prisma.booking.upsert({
      where: { code: booking.code },
      update: {},
      create: {
        code: booking.code,
        userId: user.id,
        roomId: room.id,
        checkIn: new Date(`${booking.checkIn}T00:00:00.000Z`),
        checkOut: new Date(`${booking.checkOut}T00:00:00.000Z`),
        guestCount: booking.guestCount,
        roomCount: booking.roomCount,
        serviceFee: new Prisma.Decimal(booking.serviceFee),
        totalPrice: new Prisma.Decimal(booking.totalPrice),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        roomSnapshot: JSON.stringify({
          name: room.name,
          type: room.type,
          basePrice: room.basePrice.toString(),
        }),
        propertySnapshot: JSON.stringify({
          name: room.propertyId ? 'Seed room' : 'Seed room',
          city: 'Việt Nam',
        }),
        hostSnapshot: JSON.stringify({ hostName: 'Seed host' }),
      },
    });
  }

  const totalProperties = await prisma.property.count();
  const totalRooms = await prisma.room.count();
  const totalBookings = await prisma.booking.count();

  console.log('Seed completed successfully.', {
    properties: totalProperties,
    rooms: totalRooms,
    bookings: totalBookings,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
