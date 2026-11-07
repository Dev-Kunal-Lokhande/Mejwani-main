export interface Captain {
  id: number;
  fullName: string;
  email: string;
  role: 'captain' | 'admin';
  hotel_id: number;
  hotel_name: string;
  hotel_slug: string;
  token?: string;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'billing';
  currentOrderId?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isAvailable: boolean;
  image?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  status: 'pending' | 'served' | 'cancelled';
}

export interface Order {
  id: string;
  tableId: string;
  tableNumber: string;
  captainId: string;
  items: OrderItem[];
  status: 'pending' | 'cooking' | 'served' | 'completed' | 'cancelled';
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}
