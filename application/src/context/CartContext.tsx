import React, { createContext, useContext, useState } from 'react';

export interface CartItem {
  id: string; // combination of menu_item_id and portion (e.g., '12_HALF' or '12_FULL')
  menu_item_id: number;
  name: string;
  price: number;
  qty: number;
  portion_type: 'HALF' | 'FULL';
  note: string;
}

interface CartContextType {
  activeTableId: number | null;
  activeTableName: string | null;
  activeSectionName: string | null;
  cartItems: CartItem[];
  initCartForTable: (tableId: number, tableName: string, sectionName: string, initialItems?: CartItem[]) => void;
  addToCart: (item: any, portion?: 'HALF' | 'FULL') => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemNote: (itemId: string, note: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTableId, setActiveTableId] = useState<number | null>(null);
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const initCartForTable = (tableId: number, tableName: string, sectionName: string, initialItems: CartItem[] = []) => {
    setActiveTableId(tableId);
    setActiveTableName(tableName);
    setActiveSectionName(sectionName);
    setCartItems(initialItems);
  };

  const addToCart = (item: any, portion: 'HALF' | 'FULL' = 'FULL') => {
    const isCartItem = 'menu_item_id' in item;
    const menuItemId = isCartItem ? item.menu_item_id : item.id;
    const portionType = portion;
    const itemId = `${menuItemId}_${portionType}`;

    let resolvedPrice = item.price;
    let displayName = item.name;

    if (!isCartItem && item.pricing_type === 'HALF_FULL') {
      resolvedPrice = portionType === 'HALF' ? item.half_price : item.full_price;
      const baseName = item.name.replace(/\s*\(Half\)$|\s*\(Full\)$/, '');
      displayName = baseName + (portionType === 'HALF' ? ' (Half)' : ' (Full)');
    }

    setCartItems(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing) {
        return prev.map(i => (i.id === itemId ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          id: itemId,
          menu_item_id: menuItemId,
          name: displayName,
          price: Number(resolvedPrice),
          qty: 1,
          portion_type: portionType,
          note: '',
        },
      ];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (!existing) return prev;
      if (existing.qty === 1) {
        return prev.filter(i => i.id !== itemId);
      }
      return prev.map(i => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
    });
  };

  const updateCartItemNote = (itemId: string, note: string) => {
    setCartItems(prev => prev.map(i => (i.id === itemId ? { ...i, note } : i)));
  };

  const clearCart = () => {
    setCartItems([]);
    setActiveTableId(null);
    setActiveTableName(null);
    setActiveSectionName(null);
  };

  return (
    <CartContext.Provider
      value={{
        activeTableId,
        activeTableName,
        activeSectionName,
        cartItems,
        initCartForTable,
        addToCart,
        removeFromCart,
        updateCartItemNote,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
