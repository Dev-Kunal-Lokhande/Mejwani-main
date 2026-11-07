import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, RefreshCw, Users, Bell, X, Utensils, ClipboardList, Volume2, VolumeX } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthContext, useCart, useData, useAlert } from '../context';
import { API_URL } from '../constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const { colors, spacing, isDark } = useTheme();
  const { captain, logout, token } = useAuthContext();
  const navigation = useNavigation<NavigationProp>();

  const {
    sections,
    tables,
    orders,
    captainRequests,
    isDashboardLoading: isLoading,
    errorMessage,
    fetchDashboardData,
    isMuted,
    toggleMute,
  } = useData();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hotelId = captain?.hotel_id || 0;

  // Set default active section
  useEffect(() => {
    if (!activeSection && sections && sections.length > 0) {
      setActiveSection(sections[0].section_name);
    }
  }, [sections, activeSection]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData(false);
    setIsRefreshing(false);
  };

  const handleRejectRequest = async (tableId: number) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const res = await fetch(`${API_URL}/customer/reject-captain-request?hotelId=${hotelId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tableId }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        fetchDashboardData(false);
      }
    } catch (err) {
      console.error('Failed to dismiss request:', err);
      fetchDashboardData(false);
    }
  };

  // Derive Table mapping with statuses and current order info
  const processedTables = useMemo(() => {
    return tables.map(t => {
      const activeOrder = orders.find(
        o => o.table_id === t.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
      );
      const activeRequest = captainRequests.find(
        r => r.table_id === t.id && (r.status === 'CAPTAIN_REQUESTED' || r.status === 'PENDING')
      );

      let status = t.status;
      if (activeOrder) {
        status = activeOrder.status === 'BILL_PENDING' ? 'billing' : 'occupied';
      } else if (activeRequest && t.status === 'available') {
        status = 'request_pending';
      }

      return {
        ...t,
        derivedStatus: status,
        currentOrder: activeOrder
          ? {
              kotNumber: activeOrder.kot_number,
              itemsCount: activeOrder.items?.length || 0,
              total: parseFloat(activeOrder.grand_total || '0'),
            }
          : null,
        requestType: activeRequest?.request_type || null,
      };
    });
  }, [tables, orders, captainRequests]);

  // Filtered tables based on selected section tab
  const filteredTables = useMemo(() => {
    if (!activeSection) return [];
    return processedTables.filter(t => t.section_name === activeSection);
  }, [processedTables, activeSection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return colors.danger;
      case 'billing':
        return '#f59e0b'; // Amber warning
      case 'request_pending':
        return '#eab308'; // Yellow request
      default:
        return colors.success;
    }
  };

  const getTableCardStyles = (status: string) => {
    switch (status) {
      case 'occupied':
        return {
          backgroundColor: isDark ? '#2e0a16' : '#fff5f5',
          borderColor: isDark ? '#991b1b' : '#feb2b2',
        };
      case 'billing':
        return {
          backgroundColor: isDark ? '#3b2407' : '#fffbeb',
          borderColor: isDark ? '#d97706' : '#fde68a',
        };
      case 'request_pending':
        return {
          backgroundColor: isDark ? '#3c250e' : '#fffbeb',
          borderColor: isDark ? '#d97706' : '#fde68a',
        };
      default: // available
        return {
          backgroundColor: isDark ? '#022c22' : '#f6fdf9',
          borderColor: isDark ? '#065f46' : '#a7f3d0',
        };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'AVAILABLE';
      case 'occupied':
        return 'OCCUPIED';
      case 'billing':
        return 'BILL PENDING';
      case 'request_pending':
        return 'CALL CAPTAIN';
      default:
        return status.toUpperCase();
    }
  };

  const { initCartForTable } = useCart();
  const { showAlert } = useAlert();

  const handleTablePress = (table: any) => {
    const activeOrder = orders.find(
      o => o.table_id === table.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
    );

    // Ownership check: Block access if the order is started by another captain
    if (activeOrder && activeOrder.captain_name) {
      const activeCaptainLower = activeOrder.captain_name.toLowerCase().trim();
      const currentCaptainLower = captain?.fullName?.toLowerCase().trim() || '';

      if (
        activeCaptainLower !== 'admin' &&
        activeCaptainLower !== 'captain' &&
        activeCaptainLower !== currentCaptainLower
      ) {
        showAlert({
          title: 'Access Denied',
          message: `This table is currently being serviced by Captain ${activeOrder.captain_name}. Only they can manage this order.`,
          type: 'error',
          buttons: [{ text: 'OK' }]
        });
        return;
      }
    }

    const initialItems = activeOrder && activeOrder.items ? activeOrder.items.map((item: any) => {
      const pType = item.portion_type || 'FULL';
      const isHalf = pType === 'HALF';
      const suffix = isHalf ? '_HALF' : '_FULL';
      return {
        id: `${item.menu_item_id}${suffix}`,
        menu_item_id: item.menu_item_id,
        name: item.name,
        price: parseFloat(item.price || '0'),
        qty: item.quantity || 1,
        portion_type: pType,
        note: item.note || '',
      };
    }) : [];

    initCartForTable(table.id, table.table_name || table.table_number, table.section_name, initialItems);

    navigation.navigate('Menu', {
      tableId: table.id,
      tableName: table.table_name || table.table_number,
      sectionName: table.section_name,
      activeOrderId: activeOrder ? activeOrder.id : null,
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Loading restaurant floorplan...
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
        <View style={styles.headerLeft}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
            <Utensils size={18} color="#ffffff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{captain?.hotel_name || 'Mejwani'}</Text>
            <Text style={[styles.captainName, { color: colors.textSecondary }]}>
              Captain: {captain?.fullName}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerButton, { borderColor: colors.border }]}
            onPress={toggleMute}
            accessibilityLabel={isMuted ? "Unmute Notifications" : "Mute Notifications"}
          >
            {isMuted ? (
              <VolumeX size={16} color={colors.danger} />
            ) : (
              <Volume2 size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('CompletedOrders')}
            accessibilityLabel="Today's Orders"
          >
            <ClipboardList size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { borderColor: colors.border }]}
            onPress={() => fetchDashboardData(false)}
          >
            <RefreshCw size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { borderColor: colors.border }]}
            onPress={logout}
          >
            <LogOut size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Bar */}
      {errorMessage && (
        <View style={[styles.errorBar, { backgroundColor: colors.danger + '15' }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        </View>
      )}

      {/* Section Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollTabs}
        >
          {sections.map(sec => {
            const isActive = activeSection === sec.section_name;
            // Get count of tables in section
            const sectionTables = processedTables.filter(t => t.section_name === sec.section_name);
            const occupiedCount = sectionTables.filter(t => t.derivedStatus !== 'available').length;

            return (
              <TouchableOpacity
                key={sec.id}
                style={[
                  styles.tabButton,
                  isActive
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border },
                ]}
                onPress={() => setActiveSection(sec.section_name)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: isActive ? '#ffffff' : colors.text },
                  ]}
                >
                  {sec.section_name}
                </Text>
                <View style={[styles.badge, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.border }]}>
                  <Text style={[styles.badgeText, { color: isActive ? '#ffffff' : colors.textSecondary }]}>
                    {occupiedCount}/{sectionTables.length}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tables Grid */}
      <FlatList
        data={filteredTables}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>No tables defined in this section.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOccupied = item.derivedStatus === 'occupied' || item.derivedStatus === 'billing';
          const isRequestPending = item.derivedStatus === 'request_pending';
          const indicatorColor = getStatusColor(item.derivedStatus);

          return (
            <TouchableOpacity
              style={[
                styles.tableCard,
                getTableCardStyles(item.derivedStatus),
              ]}
              onPress={() => handleTablePress(item)}
              activeOpacity={0.85}
            >
              {/* Header Status Bar */}
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: indicatorColor + '15' }]}>
                  <View style={[styles.statusDot, { backgroundColor: indicatorColor }]} />
                  <Text style={[styles.derivedStatusText, { color: indicatorColor }]}>
                    {getStatusText(item.derivedStatus)}
                  </Text>
                </View>
              </View>

              {/* Number and Seating */}
              <View style={styles.cardMain}>
                <Text style={[styles.tableNum, { color: colors.text }]}>T-{item.table_number}</Text>
                <View style={styles.capacityRow}>
                  <Users size={12} color={colors.textMuted} />
                  <Text style={[styles.capacityText, { color: colors.textSecondary }]}>
                    {item.seating_capacity} Seats
                  </Text>
                </View>
              </View>

              {/* Active requests badge */}
              {isRequestPending && (
                <View style={[styles.requestContainer, { backgroundColor: isDark ? '#262200' : '#fef9c3', borderColor: '#fef08a' }]}>
                  <View style={styles.requestBadge}>
                    <Bell size={10} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.requestText}>CALL CAPTAIN</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.requestDismiss}
                    onPress={() => handleRejectRequest(item.id)}
                  >
                    <X size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Order Info */}
              {isOccupied && item.currentOrder && (
                <View style={[styles.orderPreview, { backgroundColor: isDark ? '#1f1610' : '#fff7ed', borderColor: colors.primary + '20' }]}>
                  <Text style={[styles.orderKOT, { color: colors.textSecondary }]}>
                    {item.currentOrder.kotNumber}
                  </Text>
                  <Text style={[styles.orderPrice, { color: colors.primary }]}>
                    ₹{item.currentOrder.total.toFixed(0)} • {item.currentOrder.itemsCount} Items
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  captainName: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  errorBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabContainer: {
    paddingVertical: 12,
  },
  scrollTabs: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  tableCard: {
    flex: 0.485,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  derivedStatusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardMain: {
    marginBottom: 10,
  },
  tableNum: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  capacityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    marginTop: 8,
  },
  orderKOT: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orderPrice: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  requestContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    marginTop: 8,
  },
  requestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eab308',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requestText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  requestDismiss: {
    padding: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
});

export default DashboardScreen;
