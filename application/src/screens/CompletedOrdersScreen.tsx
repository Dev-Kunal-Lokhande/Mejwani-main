import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, FileText, Receipt } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthContext, useData, Order, useAlert } from '../context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { API_URL } from '../constants';
import { ActivityIndicator } from 'react-native';

const CompletedOrdersScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { captain, token } = useAuthContext();
  const { orders } = useData();
  const { showAlert } = useAlert();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [activeTab, setActiveTab] = useState<'completed' | 'active'>('completed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [requestingReprint, setRequestingReprint] = useState(false);

  const handleRequestReprint = async (orderId: number) => {
    setRequestingReprint(true);
    try {
      const response = await fetch(`${API_URL}/bills/reprint-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        console.warn('Reprint response was not JSON:', responseText);
        showAlert({
          title: 'Update Backend',
          message: 'Failed to reach the reprint service. Please ensure the backend server is restarted and running with the latest changes.',
          type: 'error',
          buttons: [{ text: 'OK' }]
        });
        return;
      }

      if (response.ok && data.success) {
        showAlert({
          title: 'Success',
          message: data.message || 'Reprint request sent to admin.',
          type: 'success',
          buttons: [{ text: 'OK' }]
        });
      } else {
        showAlert({
          title: 'Error',
          message: data.message || 'Failed to submit reprint request.',
          type: 'error',
          buttons: [{ text: 'OK' }]
        });
      }
    } catch (err) {
      console.error('Failed to request reprint:', err);
      showAlert({
        title: 'Error',
        message: 'Network request failed.',
        type: 'error',
        buttons: [{ text: 'OK' }]
      });
    } finally {
      setRequestingReprint(false);
    }
  };

  // Filter orders by logged-in captain and status/search query
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Captain Ownership Check
      const captainNameLower = (o.captain_name || '').toLowerCase().trim();
      const loggedCaptainLower = (captain?.fullName || '').toLowerCase().trim();
      const isOwned = captainNameLower === loggedCaptainLower;

      if (!isOwned) return false;

      // 2. Tab Filter
      const isCompleted = o.status === 'COMPLETED';
      const matchesTab = activeTab === 'completed' ? isCompleted : !isCompleted && o.status !== 'CANCELLED';

      if (!matchesTab) return false;

      // 3. Search Query Filter
      const search = searchQuery.toLowerCase().trim();
      if (!search) return true;

      const kotMatches = (o.kot_number || '').toLowerCase().includes(search);
      const tableMatches = (o.table_name || o.table_number || '').toLowerCase().includes(search);
      
      return kotMatches || tableMatches;
    });
  }, [orders, captain, activeTab, searchQuery]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day} - ${month} - ${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Orders Today</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Captain: {captain?.fullName}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'completed'
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border },
          ]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'completed' ? '#ffffff' : colors.text }]}>
            Completed ({orders.filter(o => o.status === 'COMPLETED' && (o.captain_name || '').toLowerCase().trim() === (captain?.fullName || '').toLowerCase().trim()).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'active'
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border },
          ]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'active' ? '#ffffff' : colors.text }]}>
            Active Orders ({orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (o.captain_name || '').toLowerCase().trim() === (captain?.fullName || '').toLowerCase().trim()).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrapper, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by KOT or Table..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Order List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Receipt size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              No {activeTab} orders found for today.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.orderCard,
              { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }
            ]}
            onPress={() => setSelectedOrder(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Table T-{item.table_name || item.table_number || 'Counter'}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {item.kot_number} • {formatTime(item.created_at)}
                </Text>
              </View>
              <View style={styles.cardPriceContainer}>
                <Text style={[styles.cardPrice, { color: colors.primary }]}>
                  ₹{parseFloat(item.grand_total).toFixed(0)}
                </Text>
                <Text style={[styles.cardCount, { color: colors.textMuted }]}>
                  {item.items?.length || 0} items
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.cardFooter}>
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'COMPLETED' ? colors.success + '15' : colors.warning + '15' }]}>
                <Text style={[styles.statusText, { color: item.status === 'COMPLETED' ? colors.success : colors.warning }]}>
                  {item.status}
                </Text>
              </View>
              <View style={styles.viewBillRow}>
                <FileText size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.viewBillText, { color: colors.primary }]}>View Copy Bill</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Printed Bill Receipt Modal */}
      <Modal visible={!!selectedOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.receiptCard, { backgroundColor: isDark ? colors.card : '#ffffff' }]}>
            {/* Scrollable Receipt Body */}
            <ScrollView contentContainerStyle={styles.receiptScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.receiptHotelName, { color: colors.text }]}>MEJWANI</Text>
              <Text style={[styles.receiptSubtitle, { color: colors.textSecondary }]}>
                {captain?.hotel_name || 'Premium Dine-In POS'}
              </Text>
              
              <Text style={[styles.receiptDashedLine, { color: colors.textMuted }]}>
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </Text>

              {/* Receipt metadata */}
              <View style={styles.receiptMetaRow}>
                <Text style={[styles.receiptMetaText, { color: colors.textSecondary }]}>
                  Bill No: {selectedOrder?.id}
                </Text>
                <Text style={[styles.receiptMetaText, { color: colors.textSecondary }]}>
                  Table: T-{selectedOrder?.table_name || selectedOrder?.table_number}
                </Text>
              </View>
              <View style={styles.receiptMetaRow}>
                <Text style={[styles.receiptMetaText, { color: colors.textSecondary }]}>
                  Date: {selectedOrder ? formatDate(selectedOrder.created_at) : ''}
                </Text>
                <Text style={[styles.receiptMetaText, { color: colors.textSecondary }]}>
                  Time: {selectedOrder ? formatTime(selectedOrder.created_at) : ''}
                </Text>
              </View>
              <View style={receiptMetaRowStyle()}>
                <Text style={[styles.receiptMetaText, { color: colors.textSecondary }]}>
                  KOT: {selectedOrder?.kot_number}
                </Text>
                <Text style={[styles.receiptMetaText, { color: colors.textSecondary }]}>
                  Captain: {selectedOrder?.captain_name}
                </Text>
              </View>

              <Text style={[styles.receiptDashedLine, { color: colors.textMuted }]}>
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </Text>

              {/* Table header */}
              <View style={styles.receiptItemRow}>
                <Text style={[styles.receiptItemColName, styles.itemColDesc, { color: colors.text }]}>ITEM DESCRIPTION</Text>
                <Text style={[styles.receiptItemColName, styles.itemColQty, { color: colors.text }]}>QTY</Text>
                <Text style={[styles.receiptItemColName, styles.itemColRate, { color: colors.text }]}>RATE</Text>
                <Text style={[styles.receiptItemColName, styles.itemColTotal, { color: colors.text }]}>AMT</Text>
              </View>

              <Text style={[styles.receiptDashedLine, { color: colors.textMuted }]}>
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </Text>

              {/* Items List */}
              {selectedOrder?.items?.map((item, index) => {
                const itemPrice = parseFloat(item.price as string || '0');
                return (
                  <View key={index} style={styles.receiptItemRow}>
                    <Text style={[styles.receiptItemTextDetail, styles.itemColDesc, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.receiptItemTextDetail, styles.itemColQty, { color: colors.text }]}>
                      {item.quantity}
                    </Text>
                    <Text style={[styles.receiptItemTextDetail, styles.itemColRate, { color: colors.text }]}>
                      {itemPrice.toFixed(0)}
                    </Text>
                    <Text style={[styles.receiptItemTextDetail, styles.itemColTotal, { color: colors.text }]}>
                      {(item.quantity * itemPrice).toFixed(0)}
                    </Text>
                  </View>
                );
              })}

              <Text style={[styles.receiptDashedLine, { color: colors.textMuted }]}>
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </Text>

              {/* Bill Totals */}
              <View style={styles.receiptSummaryRow}>
                <Text style={[styles.receiptSummaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.receiptSummaryValue, { color: colors.text }]}>
                  ₹{parseFloat(selectedOrder?.subtotal as string || '0').toFixed(0)}
                </Text>
              </View>
              {parseFloat(selectedOrder?.cgst as string || '0') > 0 && (
                <View style={styles.receiptSummaryRow}>
                  <Text style={[styles.receiptSummaryLabel, { color: colors.textSecondary }]}>CGST</Text>
                  <Text style={[styles.receiptSummaryValue, { color: colors.text }]}>
                    ₹{parseFloat(selectedOrder?.cgst as string || '0').toFixed(2)}
                  </Text>
                </View>
              )}
              {parseFloat(selectedOrder?.sgst as string || '0') > 0 && (
                <View style={styles.receiptSummaryRow}>
                  <Text style={[styles.receiptSummaryLabel, { color: colors.textSecondary }]}>SGST</Text>
                  <Text style={[styles.receiptSummaryValue, { color: colors.text }]}>
                    ₹{parseFloat(selectedOrder?.sgst as string || '0').toFixed(2)}
                  </Text>
                </View>
              )}

              <Text style={[styles.receiptDashedLine, { color: colors.textMuted }]}>
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </Text>

              <View style={styles.receiptSummaryRow}>
                <Text style={[styles.receiptGrandLabel, { color: colors.text }]}>GRAND TOTAL</Text>
                <Text style={[styles.receiptGrandValue, { color: colors.primary }]}>
                  ₹{parseFloat(selectedOrder?.grand_total || '0').toFixed(0)}
                </Text>
              </View>

              <Text style={[styles.receiptDashedLine, { color: colors.textMuted }]}>
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              </Text>

              <Text style={[styles.receiptFooterText, { color: colors.textMuted }]}>
                *** COPY OF BILL ***
              </Text>
              <Text style={[styles.receiptFooterText, { color: colors.textMuted }]}>
                Thank you for dining with us!
              </Text>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActionRow}>
              {selectedOrder?.status === 'COMPLETED' && (
                <TouchableOpacity
                  style={[styles.reprintBtn, { borderColor: colors.primary, borderWidth: 1.5 }]}
                  onPress={() => handleRequestReprint(selectedOrder.id)}
                  disabled={requestingReprint}
                >
                  {requestingReprint ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <FileText size={14} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.reprintBtnText, { color: colors.primary }]}>REPRINT</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => setSelectedOrder(null)}
              >
                <Text style={styles.closeBtnText}>CLOSE RECEIPT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Helper style resolve function to avoid TS lint warning about nested styles
const receiptMetaRowStyle = () => {
  return styles.receiptMetaRow;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 64,
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  cardPriceContainer: {
    alignItems: 'flex-end',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '900',
  },
  cardCount: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  divider: {
    height: 1.5,
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  viewBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewBillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    borderRadius: 24,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  receiptScroll: {
    paddingBottom: 20,
  },
  receiptHotelName: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  receiptSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  receiptDashedLine: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 4,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  receiptMetaText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  receiptItemRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    alignItems: 'flex-start',
  },
  receiptItemColName: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  receiptItemTextDetail: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  itemColDesc: {
    flex: 0.5,
    textAlign: 'left',
  },
  itemColQty: {
    flex: 0.12,
    textAlign: 'center',
  },
  itemColRate: {
    flex: 0.18,
    textAlign: 'right',
  },
  itemColTotal: {
    flex: 0.2,
    textAlign: 'right',
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptSummaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  receiptSummaryValue: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Courier',
  },
  receiptGrandLabel: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  receiptGrandValue: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  receiptFooterText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Courier',
  },
  closeBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  reprintBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reprintBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

export default CompletedOrdersScreen;
