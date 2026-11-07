import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, ShoppingCart, Plus, Minus, Info } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthContext, useCart, useData } from '../context';
import { API_URL } from '../constants';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Menu'>;
type MenuRouteProp = RouteProp<RootStackParamList, 'Menu'>;

interface MenuItem {
  id: number;
  name: string;
  marathiName: string | null;
  price: string;
  pricing_type: 'SINGLE' | 'HALF_FULL';
  half_price: string | null;
  full_price: string | null;
  category: string;
  type: 'VEG' | 'NON_VEG';
  isAvailable: boolean;
  code: string;
}

interface Category {
  id: number;
  name: string;
}

const MenuScreen: React.FC = () => {
  const { colors, spacing, isDark } = useTheme();
  const { captain, token } = useAuthContext();
  const { cartItems, addToCart, removeFromCart, activeTableId, activeTableName, activeSectionName } = useCart();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MenuRouteProp>();

  const { tableId, tableName, sectionName, activeOrderId } = route.params;

  const {
    categories,
    menuItems,
    isMenuLoading: isLoading,
    errorMessage,
    fetchMenuData
  } = useData();

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPortions, setSelectedPortions] = useState<Record<number, 'HALF' | 'FULL'>>({});

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  // Portion selection toggle handler
  const handlePortionSelect = (itemId: number, portion: 'HALF' | 'FULL') => {
    setSelectedPortions(prev => ({
      ...prev,
      [itemId]: portion,
    }));
  };

  // Cart summary calculations
  const totalQty = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.qty, 0);
  }, [cartItems]);

  const totalAmount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  }, [cartItems]);

  // Filtered menu list based on active category tab & search query
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory =
        activeCategory === 'ALL' || item.category.toUpperCase() === activeCategory.toUpperCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.marathiName && item.marathiName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [menuItems, activeCategory, searchQuery]);

  // Retrieve active item quantity in cart helper
  const getItemQtyInCart = (itemId: number, portion: 'HALF' | 'FULL') => {
    const cartId = portion === 'HALF' ? `${itemId}_HALF` : `${itemId}_FULL`;
    const cartItem = cartItems.find(i => i.id === cartId);
    return cartItem ? cartItem.qty : 0;
  };

  const handleGoToCart = () => {
    navigation.navigate('Cart', {
      tableId,
      tableName,
      sectionName,
      activeOrderId,
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Fetching fresh menu list...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>T-{tableName}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {sectionName} • Take Order
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBadgeButton, { backgroundColor: colors.primary }]}
          onPress={handleGoToCart}
        >
          <ShoppingCart size={18} color="#ffffff" />
          {totalQty > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{totalQty}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrapper, { backgroundColor: isDark ? colors.card : '#f1f5f9', borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search dish name or item code..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollCategories}
        >
          <TouchableOpacity
            style={[
              styles.categoryTab,
              activeCategory === 'ALL'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border },
            ]}
            onPress={() => setActiveCategory('ALL')}
          >
            <Text style={[styles.categoryTabText, { color: activeCategory === 'ALL' ? '#ffffff' : colors.text }]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map(cat => {
            const isTabActive = activeCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  isTabActive
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border },
                ]}
                onPress={() => setActiveCategory(cat.name)}
              >
                <Text style={[styles.categoryTabText, { color: isTabActive ? '#ffffff' : colors.text }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Menu List */}
      <FlatList
        data={filteredMenuItems}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.menuListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ color: colors.textMuted }}>No items found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isVeg = item.type === 'VEG';
          const isHalfFull = item.pricing_type === 'HALF_FULL';
          const activePortion = selectedPortions[item.id] || 'FULL';

          const currentQty = getItemQtyInCart(item.id, activePortion);
          const activePrice = isHalfFull
            ? activePortion === 'HALF'
              ? item.half_price
              : item.full_price
            : item.price;

          const cartId = activePortion === 'HALF' ? `${item.id}_HALF` : `${item.id}_FULL`;

          return (
            <View style={[styles.menuItemCard, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
              {/* Left Column: Veg/Nonveg indicator, name, code, price */}
              <View style={styles.menuItemDetails}>
                <View style={styles.itemNameRow}>
                  {/* Veg/Nonveg dot indicator box */}
                  <View style={[styles.typeIndicator, { borderColor: isVeg ? '#22c55e' : '#ef4444' }]}>
                    <View style={[styles.typeDot, { backgroundColor: isVeg ? '#22c55e' : '#ef4444' }]} />
                  </View>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                </View>

                {item.marathiName && (
                  <Text style={[styles.marathiName, { color: colors.textSecondary }]}>
                    {item.marathiName}
                  </Text>
                )}

                <View style={styles.metaRow}>
                  {item.code && (
                    <View style={[styles.codeBadge, { backgroundColor: isDark ? '#262626' : '#f1f5f9' }]}>
                      <Text style={[styles.codeText, { color: colors.textSecondary }]}>#{item.code}</Text>
                    </View>
                  )}
                  <Text style={[styles.itemPrice, { color: colors.primary }]}>
                    ₹{Number(activePrice).toFixed(0)}
                  </Text>
                </View>

                {/* Portion Selector for Half/Full pricing */}
                {isHalfFull && (
                  <View style={[styles.portionTabs, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc' }]}>
                    <TouchableOpacity
                      style={[
                        styles.portionTabButton,
                        activePortion === 'HALF'
                          ? { backgroundColor: colors.primary }
                          : null,
                      ]}
                      onPress={() => handlePortionSelect(item.id, 'HALF')}
                    >
                      <Text
                        style={[
                          styles.portionTabText,
                          { color: activePortion === 'HALF' ? '#ffffff' : colors.textSecondary },
                        ]}
                      >
                        H (₹{Number(item.half_price).toFixed(0)})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.portionTabButton,
                        activePortion === 'FULL'
                          ? { backgroundColor: colors.primary }
                          : null,
                      ]}
                      onPress={() => handlePortionSelect(item.id, 'FULL')}
                    >
                      <Text
                        style={[
                          styles.portionTabText,
                          { color: activePortion === 'FULL' ? '#ffffff' : colors.textSecondary },
                        ]}
                      >
                        F (₹{Number(item.full_price).toFixed(0)})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Right Column: Qty Controls / ADD Button */}
              <View style={styles.menuItemAction}>
                {currentQty > 0 ? (
                  <View style={[styles.qtyControls, { borderColor: colors.primary }]}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => removeFromCart(cartId)}
                    >
                      <Minus size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: colors.text }]}>{currentQty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => addToCart(item, activePortion)}
                    >
                      <Plus size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.addButton, { borderColor: colors.primary }]}
                    onPress={() => addToCart(item, activePortion)}
                  >
                    <Text style={[styles.addButtonText, { color: colors.primary }]}>ADD</Text>
                    <Plus size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Floating Bottom Cart Bar */}
      {totalQty > 0 && (
        <View style={[styles.cartSummaryBar, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
          <View>
            <Text style={[styles.summaryQty, { color: colors.textSecondary }]}>
              {totalQty} {totalQty === 1 ? 'item' : 'items'} added
            </Text>
            <Text style={[styles.summaryTotal, { color: colors.text }]}>
              Total: <Text style={{ color: colors.primary }}>₹{totalAmount.toFixed(0)}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
            onPress={handleGoToCart}
          >
            <Text style={styles.checkoutBtnText}>VIEW CART</Text>
            <ShoppingCart size={16} color="#ffffff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  cartBadgeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryContainer: {
    paddingVertical: 12,
  },
  scrollCategories: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  menuListContent: {
    paddingHorizontal: 16,
    paddingBottom: 110, // extra space to avoid overlapping with floating footer
  },
  menuItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItemDetails: {
    flex: 1,
    paddingRight: 16,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIndicator: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 2,
  },
  typeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  marathiName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    marginLeft: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 20,
    gap: 8,
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '900',
  },
  portionTabs: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginTop: 8,
    marginLeft: 20,
    width: 180,
  },
  portionTabButton: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  portionTabText: {
    fontSize: 10,
    fontWeight: '800',
  },
  menuItemAction: {
    alignItems: 'flex-end',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '900',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    width: 24,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },
  cartSummaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  summaryQty: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryTotal: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 64,
  },
});

export default MenuScreen;
